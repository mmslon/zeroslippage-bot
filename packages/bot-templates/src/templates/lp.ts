import { z } from "zod";
import type { IExchange } from "@opentrader/exchanges";
import type { BotTemplate, IBotConfiguration, SmartTradeService, TBotContext } from "@opentrader/bot-processor";
import { cancelAllTrades, cancelSmartTrade, useExchange, useSmartTrade } from "@opentrader/bot-processor";
import { computeOrderLevelsFromCurrentPrice, decomposeSymbol } from "@opentrader/tools";
import {
  StrategyEventType,
  ZLPBotSettings,
  type IGetMarketPriceResponse,
  type XOrderType,
  type XOrderSide,
  type IAccountAsset,
} from "@opentrader/types";
import { logger } from "@opentrader/logger";
import { usePriceSource } from "@opentrader/bot-processor/effects/useSource.js";

type OrderLevel = {
  type: XOrderType;
  side: XOrderSide;
  price: number;
  quantity: number;
};

/**
 * Computes all order levels including regular grid orders and support orders.
 */
function computeAllOrders(
  bot: LPBotConfig,
  sourcePrice: number,
): {
  asks: OrderLevel[];
  bids: OrderLevel[];
  all: OrderLevel[];
  regularOrderCount: number;
  supportOrderIndices: number[];
} {
  const asks = computeOrderLevelsFromCurrentPrice(
    bot.settings.asks.levels,
    bot.settings.asks.minOrderAmount,
    bot.settings.asks.maxOrderAmount,
    bot.settings.maxSpread,
    bot.settings.asks.levelSpread,
    sourcePrice,
    bot.settings.pricePrecision,
  );

  const bids = computeOrderLevelsFromCurrentPrice(
    bot.settings.bids.levels,
    bot.settings.bids.minOrderAmount,
    bot.settings.bids.maxOrderAmount,
    bot.settings.maxSpread,
    bot.settings.bids.levelSpread,
    sourcePrice,
    bot.settings.pricePrecision,
  );

  // Track regular order count before adding support orders
  const regularOrderCount = asks.length + bids.length;
  const supportOrderIndices: number[] = [];

  // Add support bid order if configured
  if (bot.settings.supportBid && bot.settings.supportBid.amount > 0) {
    supportOrderIndices.push(asks.length + bids.length);
    bids.push({
      type: "Limit" as XOrderType,
      side: "Buy" as XOrderSide,
      price: Number(bot.settings.supportBid.price.toFixed(bot.settings.pricePrecision)),
      quantity: bot.settings.supportBid.amount,
    });
  }

  // Add support ask order if configured
  if (bot.settings.supportAsk && bot.settings.supportAsk.amount > 0) {
    supportOrderIndices.push(asks.length + bids.length);
    asks.push({
      type: "Limit" as XOrderType,
      side: "Sell" as XOrderSide,
      price: Number(bot.settings.supportAsk.price.toFixed(bot.settings.pricePrecision)),
      quantity: bot.settings.supportAsk.amount,
    });
  }

  return {
    asks,
    bids,
    all: asks.concat(bids),
    regularOrderCount,
    supportOrderIndices,
  };
}

/**
 * Selects a random subset of indices from the regular orders only (excluding support orders).
 * Returns at least 1 and at most all regular order indices.
 */
function getRandomOrderIndices(regularOrderCount: number, supportOrderIndices: number[]): number[] {
  if (regularOrderCount === 0) return [];

  // Select between 1 and regularOrderCount (at least 1, at most all regular orders)
  const countToReplace = Math.floor(Math.random() * regularOrderCount) + 1;

  // Create array of only regular order indices (excluding support orders)
  const allIndices = Array.from({ length: regularOrderCount }, (_, i) => i);

  // Shuffle and take the first countToReplace elements
  const shuffled = allIndices.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, countToReplace).sort((a, b) => a - b);
}

/**
 * Places or replaces smart trades for all orders.
 */
function* placeOrders(orders: OrderLevel[], indicesToReplace?: number[]) {
  const shouldReplaceOrder = (index: number) => !indicesToReplace || indicesToReplace.includes(index);

  for (const [index, order] of orders.entries()) {
    const smartTrade: SmartTradeService = yield useSmartTrade(
      {
        entry: {
          type: order.type,
          side: order.side,
          price: order.price,
          status: "Idle",
        },
        quantity: order.quantity,
      },
      `${index}`,
    );

    if (smartTrade.isCompleted() && shouldReplaceOrder(index)) {
      yield smartTrade.replace();
    }
  }
}

/**
 * Cancels specific orders by their indices.
 */
function* cancelSpecificOrders(indicesToCancel: number[]) {
  logger.info(`[LP] Canceling ${indicesToCancel.length} orders at indices: [${indicesToCancel.join(", ")}]`);

  for (const index of indicesToCancel) {
    yield cancelSmartTrade(`${index}`);
  }
}

/**
 * Checks and logs account balances including tokens locked in open orders.
 */
function* checkBalances(exchange: IExchange, symbol: string, orders: OrderLevel[]) {
  const { baseCurrency, quoteCurrency } = decomposeSymbol(symbol);

  // Get account assets
  const assets: IAccountAsset[] = yield exchange.accountAssets();

  const baseAsset = assets.find((a) => a.currency === baseCurrency);
  const quoteAsset = assets.find((a) => a.currency === quoteCurrency);

  const availableBase = baseAsset?.balance || 0;
  const availableQuote = quoteAsset?.balance || 0;

  const totalBase = availableBase;
  const totalQuote = availableQuote;

  logger.info(`[LP] Balance - ${baseCurrency}: ${availableBase.toFixed(2)}`);
  logger.info(`[LP] Balance - ${quoteCurrency}: ${availableQuote.toFixed(2)}`);

  return {
    base: { total: totalBase },
    quote: { total: totalQuote },
  };
}

/**
 * Calculates and logs the sum of all orders in the order book between bot's best bid and ask.
 */
function* analyzeOrderBookDepth(exchange: IExchange, symbol: string, orders: OrderLevel[]) {
  const { quoteCurrency } = decomposeSymbol(symbol);

  // Find bot's best bid and ask prices
  const botBids = orders.filter((o) => o.side === "Buy");
  const botAsks = orders.filter((o) => o.side === "Sell");

  if (botBids.length === 0 || botAsks.length === 0) {
    logger.info("[LP] No bid or ask orders to analyze");
    return;
  }

  const bestBid = Math.max(...botBids.map((o) => o.price));
  const bestAsk = Math.min(...botAsks.map((o) => o.price));

  // Fetch order book
  const orderBook = yield exchange.getOrderbook(symbol);

  // Calculate total volume between best bid and ask
  let totalBidVolume = 0; // in base currency
  let totalBidValue = 0; // in quote currency
  let bidOrderCount = 0;

  for (const bid of orderBook.bids) {
    if (bid.price >= bestBid && bid.price <= bestAsk) {
      totalBidVolume += bid.quantity;
      totalBidValue += bid.price * bid.quantity;
      bidOrderCount++;
    }
  }

  let totalAskVolume = 0; // in base currency
  let totalAskValue = 0; // in quote currency
  let askOrderCount = 0;

  for (const ask of orderBook.asks) {
    if (ask.price >= bestBid && ask.price <= bestAsk) {
      totalAskVolume += ask.quantity;
      totalAskValue += ask.price * ask.quantity;
      askOrderCount++;
    }
  }

  const totalVolume = totalBidVolume + totalAskVolume;
  const totalValue = totalBidValue + totalAskValue;

  logger.info(`[LP] Order book depth between ${bestBid.toFixed(2)} and ${bestAsk.toFixed(2)} ${quoteCurrency}:`);
  logger.info(
    `[LP]   Bids: ${bidOrderCount} orders, ${totalBidVolume} volume, ${totalBidValue} ${quoteCurrency} value`,
  );
  logger.info(
    `[LP]   Asks: ${askOrderCount} orders, ${totalAskVolume} volume, ${totalAskValue} ${quoteCurrency} value`,
  );
  logger.info(
    `[LP]   Total: ${bidOrderCount + askOrderCount} orders, ${totalVolume} volume, ${totalValue} ${quoteCurrency} value`,
  );

  return {
    bestBid,
    bestAsk,
    spread: bestAsk - bestBid,
    bids: { count: bidOrderCount, volume: totalBidVolume, value: totalBidValue },
    asks: { count: askOrderCount, volume: totalAskVolume, value: totalAskValue },
    total: { count: bidOrderCount + askOrderCount, volume: totalVolume, value: totalValue },
  };
}

/**
 * Liquidity provider bot template.
 */
export function* lpBot(ctx: TBotContext<LPBotConfig>) {
  const { config: bot, onStart, onStop } = ctx;
  const { symbol } = bot;
  const { quoteCurrency } = decomposeSymbol(symbol);

  // Stop bot if requested
  if (onStop) {
    yield cancelAllTrades();
    return;
  }

  const exchange: IExchange = yield useExchange();
  const priceFromSource: { price: number } = yield usePriceSource(bot.settings.exchangeSource);

  // Log bot start
  if (onStart) {
    const { price: markPrice }: IGetMarketPriceResponse = yield exchange.getMarketPrice({ symbol });
    logger.info(`[LP] Bot started on ${symbol} pair. Current price is ${markPrice} ${quoteCurrency}`);
  }

  // Compute all orders
  const { all: orders, regularOrderCount, supportOrderIndices } = computeAllOrders(bot, priceFromSource.price);

  // Handle interval updates - cancel and replace random subset of orders
  if (ctx.event === StrategyEventType.onInterval) {
    // Check balances including locked tokens
    yield* checkBalances(exchange, symbol, orders);

    // Analyze order book depth between bot's best bid and ask
    yield* analyzeOrderBookDepth(exchange, symbol, orders);

    const indicesToReplace = getRandomOrderIndices(regularOrderCount, supportOrderIndices);
    const percentageToReplace = ((indicesToReplace.length / regularOrderCount) * 100).toFixed(1);

    logger.info(
      `[LP] Updating ${indicesToReplace.length}/${regularOrderCount} regular orders (${percentageToReplace}%) on ${symbol} pair (${supportOrderIndices.length} support orders excluded)`,
    );

    yield* cancelSpecificOrders(indicesToReplace);
    yield* placeOrders(orders, indicesToReplace);

    return;
  }

  // Initial placement of all orders
  logger.info(`[LP] Placing ${orders.length} initial orders`);
  yield* placeOrders(orders);
}

lpBot.interval = 30 * 1000;
lpBot.displayName = "Liquidity Provider Bot";
lpBot.hidden = true;
lpBot.schema = ZLPBotSettings;
lpBot.runPolicy = {
  onInterval: true,
} satisfies Template["runPolicy"];

export type LPBotConfig = IBotConfiguration<z.infer<typeof lpBot.schema>>;
type Template = BotTemplate<LPBotConfig>;
