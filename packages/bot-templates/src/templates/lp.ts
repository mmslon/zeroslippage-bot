import { z } from "zod";
import type { IExchange } from "@opentrader/exchanges";
import type { BotTemplate, IBotConfiguration, SmartTradeService, TBotContext } from "@opentrader/bot-processor";
import { cancelSmartTrade, useExchange, useSmartTrade } from "@opentrader/bot-processor";
import { computeOrderLevelsFromCurrentPrice, decomposeSymbol } from "@opentrader/tools";
import { StrategyEventType, ZLPBotSettings, type IGetMarketPriceResponse } from "@opentrader/types";
import { logger } from "@opentrader/logger";

/**
 * Liquidity provider bot template.
 */
export function* lpBot(ctx: TBotContext<LPBotConfig>) {
  const { config: bot, onStart, onStop } = ctx;

  const symbol = bot.symbol;

  const { quoteCurrency } = decomposeSymbol(symbol);

  const exchange: IExchange = yield useExchange();

  let price = 0;
  if (onStart) {
    const { price: markPrice }: IGetMarketPriceResponse = yield exchange.getMarketPrice({
      symbol,
    });
    price = markPrice;
    logger.info(`[LP] Bot started on ${symbol} pair. Current price is ${price} ${quoteCurrency}`);
  }

  let gridLevels = computeOrderLevelsFromCurrentPrice(
    bot.settings.orderLevels,
    bot.settings.minOrderAmount,
    bot.settings.maxOrderAmount,
    bot.settings.initialSpread,
    bot.settings.stepSpread,
    price,
  );

  if (ctx.event === StrategyEventType.onInterval) {
    const { price: markPrice }: IGetMarketPriceResponse = yield exchange.getMarketPrice({
      symbol,
    });
    price = markPrice;
    logger.info(`[LP] Updating orders on ${symbol} pair at price ${price} ${quoteCurrency}`);

    logger.info(`[LP] Closing existing orders`);

    for (const [index, _grid] of gridLevels.entries()) {
      yield cancelSmartTrade(`${index}`);
    }

    gridLevels = computeOrderLevelsFromCurrentPrice(
      bot.settings.orderLevels,
      bot.settings.minOrderAmount,
      bot.settings.maxOrderAmount,
      bot.settings.initialSpread,
      bot.settings.stepSpread,
      price,
    );

    logger.info(`[LP] Placing new orders`);

    for (const [index, grid] of gridLevels.entries()) {
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
    console.log("stop");
    for (const [index, _grid] of gridLevels.entries()) {
      yield cancelSmartTrade(`${index}`);
    }

    return;
  }

  for (const [index, grid] of gridLevels.entries()) {
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

lpBot.interval = 15 * 1000;
lpBot.displayName = "Liquidity Provider Bot";
lpBot.hidden = true;
lpBot.schema = ZLPBotSettings;
lpBot.runPolicy = {
  onInterval: true,
} satisfies Template["runPolicy"];

export type LPBotConfig = IBotConfiguration<z.infer<typeof lpBot.schema>>;
type Template = BotTemplate<LPBotConfig>;
