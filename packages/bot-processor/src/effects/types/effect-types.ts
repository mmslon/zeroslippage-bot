export const ALL = "ALL";

export const USE_SMART_TRADE = "USE_SMART_TRADE";
export const USE_TRADE = "USE_TRADE";
export const USE_ARB_TRADE = "USE_ARB_TRADE";
export const USE_DCA = "USE_DCA";
export const BUY = "BUY";
export const SELL = "SELL";
export const REPLACE_SMART_TRADE = "REPLACE_SMART_TRADE";
export const GET_SMART_TRADE = "GET_SMART_TRADE";
export const CREATE_SMART_TRADE = "CREATE_SMART_TRADE";
export const CANCEL_SMART_TRADE = "CANCEL_SMART_TRADE";
export const GET_OPEN_TRADES = "GET_OPEN_TRADES";
export const CANCEL_ALL_TRADES = "CANCEL_ALL_TRADES";
export const USE_EXCHANGE = "USE_EXCHANGE";
export const USE_INDICATOR = "USE_INDICATOR";
export const USE_INDICATORS = "USE_INDICATORS";
export const USE_MARKET = "USE_MARKET";
export const USE_CANDLE = "USE_CANDLE";
export const USE_RSI_INDICATOR = "USE_RSI_INDICATOR";

export type EffectType =
  | typeof ALL
  | typeof USE_SMART_TRADE
  | typeof USE_TRADE
  | typeof USE_ARB_TRADE
  | typeof USE_DCA
  | typeof BUY
  | typeof SELL
  | typeof REPLACE_SMART_TRADE
  | typeof GET_SMART_TRADE
  | typeof CREATE_SMART_TRADE
  | typeof CANCEL_SMART_TRADE
  | typeof GET_OPEN_TRADES
  | typeof CANCEL_ALL_TRADES
  | typeof USE_EXCHANGE
  | typeof USE_INDICATOR
  | typeof USE_INDICATORS
  | typeof USE_MARKET
  | typeof USE_CANDLE
  | typeof USE_RSI_INDICATOR;
