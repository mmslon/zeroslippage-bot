import { z } from "zod";
import type { IExchange } from "@opentrader/exchanges";
import { MarketData, ICandlestick, BarSize } from "@opentrader/types";
import type { TBotContext } from "@opentrader/bot-processor";
import { useMarket, useCandle, useExchange } from "@opentrader/bot-processor";
import { logger } from "@opentrader/logger";

export function* testCandle(ctx: TBotContext<any>) {
  const { config: bot, onStart, onStop } = ctx;
  const exchange: IExchange = yield useExchange();

  if (onStart) {
    const candles: ICandlestick[] = yield exchange.getCandlesticks({
      symbol: "BTC/USDT",
      bar: BarSize.ONE_MINUTE,
    });
    logger.info(`[CandleStrategy] Display volume in ${JSON.stringify(candles)}`);

    logger.info(`[CandleStrategy] Bot started. Using ${exchange.exchangeCode} exchange`);
    return;
  }
  if (onStop) {
    logger.info(`[CandleStrategy] Bot stopped`);
    return;
  }

  const market: MarketData = yield useMarket();
  logger.info(market, `[CandleStrategy] Market data`);

  const candle: MarketData["candle"] = yield useCandle();
  logger.info(`[CandleStrategy] Candle ${JSON.stringify(candle)}`);

  logger.info(`[CandleStrategy] Bot template executed successfully`);
}

testCandle.schema = z.object({});
testCandle.hidden = true;
