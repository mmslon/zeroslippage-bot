import { z } from "zod";
import type { IExchange } from "@opentrader/exchanges";
import type { BotTemplate, IBotConfiguration, SmartTradeService, TBotContext } from "@opentrader/bot-processor";
import { cancelAllTrades, cancelSmartTrade, useExchange, useSmartTrade } from "@opentrader/bot-processor";
import { computeOrderLevelsFromCurrentPrice, decomposeSymbol } from "@opentrader/tools";
import { StrategyEventType, ZLPBotSettings, type IGetMarketPriceResponse } from "@opentrader/types";
import { logger } from "@opentrader/logger";
import { usePriceSource } from "@opentrader/bot-processor/effects/useSource.js";

/**
 * Liquidity provider bot template.
 */
export function* lpBot(ctx: TBotContext<LPBotConfig>) {
  const { config: bot, onStart, onStop } = ctx;
  const symbol = bot.symbol;
  const { quoteCurrency } = decomposeSymbol(symbol);

  const exchange: IExchange = yield useExchange();
  const priceFromSource: {
    price: number;
  } = yield usePriceSource(bot.settings.exchangeSource);

  let price = 0;

  console.log(priceFromSource);
  if (onStart) {
    const { price: markPrice }: IGetMarketPriceResponse = yield exchange.getMarketPrice({
      symbol,
    });
    price = markPrice;
    logger.info(`[LP] Bot started on ${symbol} pair. Current price is ${price} ${quoteCurrency}`);
  }

  let asks = computeOrderLevelsFromCurrentPrice(
    bot.settings.asks.levels,
    bot.settings.asks.minOrderAmount,
    bot.settings.asks.maxOrderAmount,
    bot.settings.initialSpread,
    bot.settings.asks.levelSpread,
    priceFromSource.price,
    bot.settings.pricePrecision,
  );

  let bids = computeOrderLevelsFromCurrentPrice(
    bot.settings.bids.levels,
    bot.settings.bids.minOrderAmount,
    bot.settings.bids.maxOrderAmount,
    bot.settings.initialSpread,
    bot.settings.bids.levelSpread,
    priceFromSource.price,
    bot.settings.pricePrecision,
  );

  let orders = asks.concat(bids);

  if (ctx.event === StrategyEventType.onInterval) {
    logger.info(`[LP] Updating orders on ${symbol} pair at price ${price} ${quoteCurrency}`);
    logger.info(`[LP] Closing existing orders`);

    yield cancelAllTrades();

    asks = computeOrderLevelsFromCurrentPrice(
      bot.settings.asks.levels,
      bot.settings.asks.minOrderAmount,
      bot.settings.asks.maxOrderAmount,
      bot.settings.initialSpread,
      bot.settings.asks.levelSpread,
      priceFromSource.price,
      bot.settings.pricePrecision,
    );

    bids = computeOrderLevelsFromCurrentPrice(
      bot.settings.bids.levels,
      bot.settings.bids.minOrderAmount,
      bot.settings.bids.maxOrderAmount,
      bot.settings.initialSpread,
      bot.settings.bids.levelSpread,
      priceFromSource.price,
      bot.settings.pricePrecision,
    );

    orders = asks.concat(bids);

    logger.info(`[LP] Placing new orders`);

    for (const [index, grid] of orders.entries()) {
      const smartTrade: SmartTradeService = yield useSmartTrade(
        {
          entry: {
            type: grid.type,
            side: grid.side,
            price: grid.price,
            status: "Idle",
          },
          quantity: grid.quantity,
        },
        `${index}`,
      );

      if (smartTrade.isCompleted()) {
        yield smartTrade.replace();
      }
    }
  }

  if (onStop) {
    yield cancelAllTrades();

    return;
  }

  for (const [index, grid] of orders.entries()) {
    const smartTrade: SmartTradeService = yield useSmartTrade(
      {
        entry: {
          type: grid.type,
          side: grid.side,
          price: grid.price,
          status: "Idle",
        },
        quantity: grid.quantity,
      },
      `${index}`,
    );

    if (smartTrade.isCompleted()) {
      yield smartTrade.replace();
    }
  }
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
