import type { ExchangeCode } from "@opentrader/types";

export interface IExchangeCredentials {
  code: ExchangeCode;
  apiKey: string;
  secretKey: string;
  password: string; // or password (depends on the exchange)
  privateKey?: string;
  walletAddress?: string;
  isDemoAccount: boolean;
  isPaperAccount: boolean;
  memo?: string;
}
