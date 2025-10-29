import { ExchangeCode } from "@opentrader/types";
import { createExchange } from "./ccxt/factory.js";
import { exchangeCodeMapCCXT } from "../client/constants.js";

export const exchanges: Record<ExchangeCode, ReturnType<typeof createExchange>> = {
  [ExchangeCode.OKX]: createExchange(ExchangeCode.OKX),
  [ExchangeCode.BYBIT]: createExchange(ExchangeCode.BYBIT),
  [ExchangeCode.BITGET]: createExchange(ExchangeCode.BITGET),
  [ExchangeCode.BINANCE]: createExchange(ExchangeCode.BINANCE),
  [ExchangeCode.KRAKEN]: createExchange(ExchangeCode.KRAKEN),
  [ExchangeCode.COINBASE]: createExchange(ExchangeCode.COINBASE),
  [ExchangeCode.GATEIO]: createExchange(ExchangeCode.GATEIO),
  [ExchangeCode.XT]: createExchange(ExchangeCode.XT),
  [ExchangeCode.BITMART]: createExchange(ExchangeCode.BITMART),
} as const;

export { exchangeCodeMapCCXT };
