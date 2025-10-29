import { z } from "zod";
import { ZBotState } from "./bot.schema.js";

export const ZLPBotSettings = z.object({
  orderLevels: z.number(),
  minOrderAmount: z.number(),
  maxOrderAmount: z.number(),
  initialSpread: z.number(),
  stepSpread: z.number(),
});

export type TLPBotSettings = z.infer<typeof ZLPBotSettings>;
export type TLPBotState = z.infer<typeof ZBotState>;
