import { z } from "zod";
import type { IExchange } from "@opentrader/exchanges";
import type { IBotConfiguration, SmartTradeService, TBotContext } from "@opentrader/bot-processor";
import { cancelSmartTrade, useExchange, useSmartTrade } from "@opentrader/bot-processor";
import { computeOrderLevelsFromCurrentPrice, decomposeSymbol } from "@opentrader/tools";
import { ZLPBotSettings, type IGetMarketPriceResponse } from "@opentrader/types";
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

  const gridLevels = computeOrderLevelsFromCurrentPrice(
    bot.settings.orderLevels,
    bot.settings.minOrderAmount,
    bot.settings.maxOrderAmount,
    bot.settings.initialSpread,
    bot.settings.stepSpread,
    price,
  );

  if (onStop) {
    for (const [index, _grid] of gridLevels.entries()) {
      yield cancelSmartTrade(`${index}`);
    }

    return;
  }

  for (const [index, grid] of gridLevels.entries()) {
    const smartTrade: SmartTradeService = yield useSmartTrade(
      {
        entry: {
          type: "Limit",
          side: "Buy",
          price: grid.buy.price,
          status: grid.buy.status,
        },
        tp: {
          type: "Limit",
          side: "Sell",
          price: grid.sell.price,
          status: grid.sell.status,
        },
        quantity: grid.buy.quantity, // or grid.sell.quantity
      },
      `${index}`,
    );

    if (smartTrade.isCompleted()) {
      yield smartTrade.replace();
    }
  }
}

lpBot.displayName = "Liquidity Provider Bot";
lpBot.hidden = true;
lpBot.schema = ZLPBotSettings;
lpBot.runPolicy = {
  onTradeCompleted: true,
};

export type LPBotConfig = IBotConfiguration<z.infer<typeof lpBot.schema>>;
