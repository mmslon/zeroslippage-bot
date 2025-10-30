import { z } from "zod";
import { ZBotState } from "./bot.schema.js";

export const ZExchangeSourceSchema = z.object({
  exchange: z.string(),
  pair: z.string(),
  priceCoefficient: z.number().optional().default(1),
});

export const ZOrdersSchema = z.object({
  levels: z.number(),
  levelSpread: z.number(),
  minOrderAmount: z.number(),
  maxOrderAmount: z.number(),
});

export const ZSupportOrderSchema = z.object({
  price: z.number(),
  amount: z.number(),
});

export const ZLPBotSettings = z.object({
  maxSpread: z.number(),
  useMaxSpread: z.boolean(),
  pricePrecision: z.number().optional().default(2),
  exchangeSource: ZExchangeSourceSchema,
  supportBid: ZSupportOrderSchema.optional(),
  supportAsk: ZSupportOrderSchema.optional(),
  bids: ZOrdersSchema,
  asks: ZOrdersSchema,
  tokensBalanceThreshold: z.number().optional(),
  usdtBalanceThreshold: z.number().optional(),
});

export type TLPBotSettings = z.infer<typeof ZLPBotSettings>;
export type TLPBotState = z.infer<typeof ZBotState>;
