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

// Constants
const DEFAULT_UPDATE_INTERVAL_MS = 1000;

type OrderLevel = {
  type: XOrderType;
  side: XOrderSide;
  price: number;
  quantity: number;
};

type Balances = {
  base: { total: number; available: number; currency: string };
  quote: { total: number; available: number; currency: string };
};

type BalanceCheckResult = {
  balances: Balances;
  shouldStop: boolean;
  stopReason?: string;
};

/**
 * Computes all order levels including regular grid orders and support orders.
 */
function computeAllOrders(
  bot: LPBotConfig,
  sourcePrice: number,
  bestBid?: number,
  bestAsk?: number,
): {
  asks: OrderLevel[];
  bids: OrderLevel[];
  all: OrderLevel[];
  regularOrderCount: number;
  supportOrderIndices: number[];
} {
  // Determine initial spread based on useMaxSpread setting
  let initialAskSpread = bot.settings.maxSpread;
  let initialBidSpread = bot.settings.maxSpread;

  if (!bot.settings.useMaxSpread && bestBid && bestAsk) {
    // Calculate current market spread
    const marketSpread = (bestAsk - bestBid) / sourcePrice;
    const maxSpreadDecimal = bot.settings.maxSpread;

    // Try to place orders at best available prices, but don't exceed maxSpread
    if (marketSpread <= maxSpreadDecimal) {
      // Market spread is acceptable, try to match or slightly improve it
      initialAskSpread = Math.max((bestAsk - sourcePrice) / sourcePrice, 0);
      initialBidSpread = Math.max((sourcePrice - bestBid) / sourcePrice, 0);
      logger.info(
        `[LP] Using tight spread - Ask: ${(initialAskSpread * 100).toFixed(4)}%, Bid: ${(initialBidSpread * 100).toFixed(4)}%`,
      );
    } else {
      // Market spread is too large, use maxSpread instead
      initialAskSpread = maxSpreadDecimal;
      initialBidSpread = maxSpreadDecimal;
      logger.info(
        `[LP] Market spread (${(marketSpread * 100).toFixed(4)}%) exceeds maxSpread (${(maxSpreadDecimal * 100).toFixed(4)}%), using maxSpread`,
      );
    }
  }

  const asks = computeOrderLevelsFromCurrentPrice(
    bot.settings.asks.levels,
    bot.settings.asks.minOrderAmount,
    bot.settings.asks.maxOrderAmount,
    initialAskSpread,
    bot.settings.asks.levelSpread,
    sourcePrice,
    bot.settings.pricePrecision,
  );

  const bids = computeOrderLevelsFromCurrentPrice(
    bot.settings.bids.levels,
    bot.settings.bids.minOrderAmount,
    bot.settings.bids.maxOrderAmount,
    initialBidSpread,
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
 * Gets the next order index to update, cycling through all regular orders sequentially.
 * Returns the next index and updates the current index counter.
 */
function getNextOrderIndex(
  regularOrderCount: number,
  supportOrderIndices: number[],
  currentIndex: number,
): { nextIndex: number; newCurrentIndex: number } {
  if (regularOrderCount === 0) return { nextIndex: -1, newCurrentIndex: 0 };

  // Use the current index and increment for next time
  const nextIndex = currentIndex % regularOrderCount;
  const newCurrentIndex = (currentIndex + 1) % regularOrderCount;

  return { nextIndex, newCurrentIndex };
}

/**
 * Validates and deducts balance for an order if balance protection is enabled.
 * Returns true if the order can be placed, false otherwise.
 */
function validateAndDeductBalance(
  order: OrderLevel,
  index: number,
  bot: LPBotConfig | undefined,
  balances: Balances | undefined,
): boolean {
  if (!bot || !balances) {
    return true;
  }

  const { shouldPlace, reason } = shouldPlaceOrder(order, bot, balances);
  if (!shouldPlace) {
    logger.warn(`[LP] Skipping order ${index} due to balance protection: ${reason}`);
    return false;
  }

  // Deduct the order amount from available balance for subsequent checks
  if (order.side === "Sell") {
    balances.base.available -= order.quantity;
  } else if (order.side === "Buy") {
    balances.quote.available -= order.quantity * order.price;
  }

  return true;
}

/**
 * Places or replaces smart trades for all orders.
 */
function* placeOrders(orders: OrderLevel[], indicesToReplace?: number[], bot?: LPBotConfig, balances?: Balances) {
  const shouldReplaceOrder = (index: number) => !indicesToReplace || indicesToReplace.includes(index);

  // Create a mutable copy of balances for tracking
  const currentBalances = balances
    ? {
        base: { ...balances.base },
        quote: { ...balances.quote },
      }
    : undefined;

  for (const [index, order] of orders.entries()) {
    // Check balance protection if enabled
    if (shouldReplaceOrder(index)) {
      const canPlace = validateAndDeductBalance(order, index, bot, currentBalances);
      if (!canPlace) {
        continue;
      }
    }

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

    // Replace order if it should be replaced and either:
    // - It's completed (filled), so we create a new one
    // - It exists but isn't completed, so we cancel and replace it
    if (shouldReplaceOrder(index)) {
      if (smartTrade.isCompleted()) {
        // Order was filled, create a new one
        yield smartTrade.replace();
      } else if (smartTrade.ref) {
        // Order exists but wasn't filled, cancel and replace it
        yield smartTrade.replace();
      } else {
        // Order doesn't exist, just create it (this handles the first placement)
        yield smartTrade.replace();
      }
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
 * Returns balance information and a flag indicating if the bot should stop due to low balance.
 */
function* checkBalances(
  exchange: IExchange,
  symbol: string,
  orders: OrderLevel[],
  bot: LPBotConfig,
): Generator<any, BalanceCheckResult, any> {
  const { baseCurrency, quoteCurrency } = decomposeSymbol(symbol);

  // Get account assets
  const assets: IAccountAsset[] = yield exchange.accountAssets();

  const baseAsset = assets.find((a) => a.currency === baseCurrency);
  const quoteAsset = assets.find((a) => a.currency === quoteCurrency);

  const availableBase = baseAsset?.balance || 0;
  const availableQuote = quoteAsset?.balance || 0;

  logger.info(`[LP] Balance - ${baseCurrency}: ${availableBase.toFixed(2)}`);
  logger.info(`[LP] Balance - ${quoteCurrency}: ${availableQuote.toFixed(2)}`);

  const balances = {
    base: { total: availableBase, available: availableBase, currency: baseCurrency },
    quote: { total: availableQuote, available: availableQuote, currency: quoteCurrency },
  };

  // Check if bot should stop due to low balance
  if (bot.settings.balanceProtection.enabled) {
    const minBase = bot.settings.balanceProtection.baseAssetMinBalance || 0;
    const minQuote = bot.settings.balanceProtection.quoteAssetMinBalabce || 0;

    if (availableBase < minBase) {
      return {
        balances,
        shouldStop: true,
        stopReason: `Total ${baseCurrency} balance (${availableBase.toFixed(2)}) is below minimum threshold (${minBase})`,
      };
    }

    if (availableQuote < minQuote) {
      return {
        balances,
        shouldStop: true,
        stopReason: `Total ${quoteCurrency} balance (${availableQuote.toFixed(2)}) is below minimum threshold (${minQuote})`,
      };
    }
  }

  return { balances, shouldStop: false };
}

/**
 * Filters orders based on balance protection settings.
 * Returns true if the order should be placed, false if it should be skipped due to insufficient balance.
 */
function shouldPlaceOrder(
  order: OrderLevel,
  bot: LPBotConfig,
  balances: Balances,
): { shouldPlace: boolean; reason?: string } {
  const { balanceProtection } = bot.settings;

  // If balance protection is disabled, place all orders
  if (!balanceProtection.enabled) {
    return { shouldPlace: true };
  }

  const isSellOrder = order.side === "Sell";
  const currency = isSellOrder ? balances.base : balances.quote;
  const requiredAmount = isSellOrder ? order.quantity : order.quantity * order.price;
  const minBalance = isSellOrder
    ? balanceProtection.baseAssetMinBalance || 0
    : balanceProtection.quoteAssetMinBalabce || 0;
  const balanceAfterOrder = currency.available - requiredAmount;

  if (balanceAfterOrder < minBalance) {
    return {
      shouldPlace: false,
      reason: `Insufficient ${currency.currency} balance. Available: ${currency.available.toFixed(2)}, Required: ${requiredAmount.toFixed(2)}, Min protected: ${minBalance.toFixed(2)}`,
    };
  }

  return { shouldPlace: true };
}

/**
 * Calculates and logs the sum of all orders in the order book between bot's best bid and ask.
 */
function* analyzeOrderBookDepth(exchange: IExchange, symbol: string, orders: OrderLevel[]): Generator<any, any, any> {
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
    `[LP]   Bids: ${bidOrderCount} orders, ${totalBidVolume.toFixed(2)} volume, ${totalBidValue.toFixed(2)} ${quoteCurrency} value`,
  );
  logger.info(
    `[LP]   Asks: ${askOrderCount} orders, ${totalAskVolume.toFixed(2)} volume, ${totalAskValue.toFixed(2)} ${quoteCurrency} value`,
  );
  logger.info(
    `[LP]   Total: ${bidOrderCount + askOrderCount} orders, ${totalVolume.toFixed(2)} volume, ${totalValue.toFixed(2)} ${quoteCurrency} value`,
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
 * Clears the spread by executing market orders to consume orders between bot's best bid and ask.
 */
function* clearSpread(exchange: IExchange, symbol: string, orders: OrderLevel[]): Generator<any, any, any> {
  // Find bot's best bid and ask prices
  const botBids = orders.filter((o) => o.side === "Buy");
  const botAsks = orders.filter((o) => o.side === "Sell");

  if (botBids.length === 0 || botAsks.length === 0) {
    logger.debug("[LP] No bid or ask orders to clear spread");
    return;
  }

  const myBestBid = Math.max(...botBids.map((o) => o.price));
  const myBestAsk = Math.min(...botAsks.map((o) => o.price));

  // Fetch current order book
  const orderBook: any = yield exchange.getOrderbook(symbol);

  // Find all asks between my best bid and my best ask (others selling below my ask)
  const asksToTake = orderBook.asks.filter((ask: any) => ask.price < myBestAsk && ask.price > myBestBid);

  // Find all bids between my best bid and my best ask (others buying above my bid)
  const bidsToTake = orderBook.bids.filter((bid: any) => bid.price > myBestBid && bid.price < myBestAsk);

  if (asksToTake.length === 0 && bidsToTake.length === 0) {
    logger.debug("[LP] No orders to clear in spread");
    return;
  }

  // Calculate total volume to take
  const totalAsksVolume = asksToTake.reduce((sum: number, ask: any) => sum + ask.quantity, 0);
  const totalBidsVolume = bidsToTake.reduce((sum: number, bid: any) => sum + bid.quantity, 0);

  logger.info(
    `[LP] Clearing spread between ${myBestBid.toFixed(2)} and ${myBestAsk.toFixed(2)}: ${asksToTake.length} asks (${totalAsksVolume.toFixed(4)} volume), ${bidsToTake.length} bids (${totalBidsVolume.toFixed(4)} volume)`,
  );

  // Take asks (buy them) - orders selling below my ask price
  for (const ask of asksToTake) {
    try {
      logger.info(`[LP] Buying ${ask.quantity.toFixed(4)} at ${ask.price.toFixed(2)} (clearing ask)`);
      yield exchange.placeOrder({
        symbol,
        type: "Market",
        side: "buy",
        quantity: ask.quantity,
      });
    } catch (error) {
      logger.warn(
        `[LP] Failed to clear ask at ${ask.price}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Take bids (sell to them) - orders buying above my bid price
  for (const bid of bidsToTake) {
    try {
      logger.info(`[LP] Selling ${bid.quantity.toFixed(4)} at ${bid.price.toFixed(2)} (clearing bid)`);
      yield exchange.placeOrder({
        symbol,
        type: "Market",
        side: "sell",
        quantity: bid.quantity,
      });
    } catch (error) {
      logger.warn(
        `[LP] Failed to clear bid at ${bid.price}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
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

  // Apply price coefficient to the source price
  const adjustedPrice = priceFromSource.price * (bot.settings.exchangeSource.priceCoefficient || 1);

  // Log bot start
  if (onStart) {
    const { price: markPrice }: IGetMarketPriceResponse = yield exchange.getMarketPrice({ symbol });
    logger.info(
      `[LP] Bot started on ${symbol} pair. Current price is ${markPrice.toFixed(bot.settings.pricePrecision)} ${quoteCurrency}`,
    );
    logger.info(
      `[LP] Using price source: ${bot.settings.exchangeSource.pair} on ${bot.settings.exchangeSource.exchange} (coefficient: ${bot.settings.exchangeSource.priceCoefficient || 1})`,
    );
    logger.info(
      `[LP] Source price: ${priceFromSource.price.toFixed(bot.settings.pricePrecision)}, Adjusted price: ${adjustedPrice.toFixed(bot.settings.pricePrecision)}`,
    );

    // Log balance protection settings
    if (bot.settings.balanceProtection.enabled) {
      const { baseCurrency } = decomposeSymbol(symbol);
      const minBase = bot.settings.balanceProtection.baseAssetMinBalance || 0;
      const minQuote = bot.settings.balanceProtection.quoteAssetMinBalabce || 0;
      logger.info(
        `[LP] Balance protection enabled - Min ${baseCurrency}: ${minBase}, Min ${quoteCurrency}: ${minQuote}`,
      );
    } else {
      logger.info("[LP] Balance protection disabled");
    }

    // Log spread settings
    logger.info(
      `[LP] Max spread: ${(bot.settings.maxSpread * 100).toFixed(4)}%, Use tight spread: ${!bot.settings.useMaxSpread ? "enabled" : "disabled"}`,
    );
  }

  // Fetch order book if useMaxSpread is enabled
  let bestBid: number | undefined;
  let bestAsk: number | undefined;

  if (!bot.settings.useMaxSpread) {
    try {
      const orderBook: any = yield exchange.getOrderbook(symbol);
      bestBid = orderBook.bids[0]?.price;
      bestAsk = orderBook.asks[0]?.price;

      if (bestBid && bestAsk) {
        const marketSpread = ((bestAsk - bestBid) / adjustedPrice) * 100;
        logger.info(
          `[LP] Market spread: ${marketSpread.toFixed(4)}% (Bid: ${bestBid.toFixed(bot.settings.pricePrecision)}, Ask: ${bestAsk.toFixed(bot.settings.pricePrecision)})`,
        );
      }
    } catch (error) {
      logger.warn(
        `[LP] Failed to fetch order book for spread optimization: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Compute all orders
  const {
    all: orders,
    regularOrderCount,
    supportOrderIndices,
  } = computeAllOrders(bot, adjustedPrice, bestBid, bestAsk);

  // Handle interval updates - cancel and replace one order at a time, cycling through all orders
  if (ctx.event === StrategyEventType.onInterval) {
    // Check balances including locked tokens
    const { balances, shouldStop, stopReason } = yield* checkBalances(exchange, symbol, orders, bot);

    // Stop bot if balance is below threshold
    if (shouldStop) {
      logger.error(`[LP] Stopping bot: ${stopReason}`);
      yield cancelAllTrades();
      return;
    }

    // Analyze order book depth between bot's best bid and ask
    yield* analyzeOrderBookDepth(exchange, symbol, orders);

    // Clear spread by taking orders between bot's best bid and ask
    yield* clearSpread(exchange, symbol, orders);

    // Log price tracking info
    logger.info(
      `[LP] Source price: ${priceFromSource.price.toFixed(bot.settings.pricePrecision)}, Adjusted price: ${adjustedPrice.toFixed(bot.settings.pricePrecision)} (coeff: ${bot.settings.exchangeSource.priceCoefficient || 1})`,
    );

    // Check for filled or missing orders and replace them immediately
    const indicesToReplace: number[] = [];

    try {
      for (let index = 0; index < orders.length; index++) {
        const smartTrade: SmartTradeService = yield useSmartTrade(
          {
            entry: {
              type: orders[index].type,
              side: orders[index].side,
              price: orders[index].price,
              status: "Idle",
            },
            quantity: orders[index].quantity,
          },
          `${index}`,
        );

        // Check if order was filled or doesn't exist
        if (smartTrade.isCompleted() || !smartTrade.ref) {
          indicesToReplace.push(index);
        }
      }
    } catch (error) {
      // Log the error but continue - don't crash the bot
      logger.warn(`[LP] Error checking order status: ${error instanceof Error ? error.message : String(error)}`);
      logger.warn("[LP] Continuing with partial order check results");
    }

    // Replace all filled or missing orders
    if (indicesToReplace.length > 0) {
      logger.info(
        `[LP] Detected ${indicesToReplace.length} filled/missing orders at indices: [${indicesToReplace.join(", ")}]. Replacing immediately.`,
      );
      yield* placeOrders(orders, indicesToReplace, bot, balances);
    } else {
      // If no filled orders, continue with regular cycle-based update
      // Initialize or retrieve current order index from bot state
      const currentOrderIndex = (ctx.state?.currentOrderIndex as number) || 0;

      // Get next order to update
      const { nextIndex, newCurrentIndex } = getNextOrderIndex(
        regularOrderCount,
        supportOrderIndices,
        currentOrderIndex,
      );

      if (nextIndex >= 0) {
        const cycleProgress = `${nextIndex + 1}/${regularOrderCount}`;
        const cycleStatus = newCurrentIndex === 0 ? " (cycle complete, restarting)" : "";

        logger.info(
          `[LP] Updating order ${nextIndex} (${cycleProgress})${cycleStatus} on ${symbol} pair (${supportOrderIndices.length} support orders excluded)`,
        );

        yield* cancelSpecificOrders([nextIndex]);
        yield* placeOrders(orders, [nextIndex], bot, balances);

        // Update state with new index for next interval
        ctx.state.currentOrderIndex = newCurrentIndex;
      }
    }

    return;
  }

  // Initial placement of all orders
  logger.info(`[LP] Placing ${orders.length} initial orders`);

  // Check balances for initial placement with balance protection
  const { balances, shouldStop, stopReason } = yield* checkBalances(exchange, symbol, orders, bot);

  // Stop bot if balance is below threshold
  if (shouldStop) {
    logger.error(`[LP] Cannot start bot: ${stopReason}`);
    return;
  }

  yield* placeOrders(orders, undefined, bot, balances);

  // Initialize state for sequential order updates
  ctx.state.currentOrderIndex = 0;
}

lpBot.interval = DEFAULT_UPDATE_INTERVAL_MS;
lpBot.displayName = "Liquidity Provider Bot";
lpBot.hidden = true;
lpBot.schema = ZLPBotSettings;
lpBot.runPolicy = {
  onInterval: true,
} satisfies Template["runPolicy"];

export type LPBotConfig = IBotConfiguration<z.infer<typeof lpBot.schema>>;
type Template = BotTemplate<LPBotConfig>;
