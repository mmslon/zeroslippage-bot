import type { SmartTradeEntity_Order_Order } from "@opentrader/db";
import { toSmartTradeEntity, xprisma } from "@opentrader/db";
import type { Context } from "../../../../utils/context.js";
import type { TGetPendingSmartTradesInputSchema } from "./schema.js";

type Options = {
  ctx: {
    user: NonNullable<Context["user"]>;
  };
  input: TGetPendingSmartTradesInputSchema;
};

export async function getPendingSmartTrades({ ctx, input }: Options) {
  const smartTrades = await xprisma.smartTrade.findMany({
    where: {
      type: "Trade",
      entryType: "Order",
      takeProfitType: "Order",
      owner: {
        id: ctx.user.id,
      },
      bot: {
        id: input.botId,
      },
      orders: {
        // Querying orders:
        // + Idle/Idle
        // - Placed/Idle
        // + Filled/Idle
        // - Filled/Placed
        // - Filled/Filled
        every: {
          status: {
            in: ["Idle", "Filled"],
          },
        },
      },
      ref: {
        not: null,
      },
    },
    include: {
      orders: true,
      exchangeAccount: true,
    },
  });

  const smartTradesDto = smartTrades.map(
    toSmartTradeEntity,
  ) as SmartTradeEntity_Order_Order[]; // more concrete type (need to add a generic prop to "toSmartTradeEntity()")

  return smartTradesDto.sort(
    (left, right) => right.entryOrder.price! - left.entryOrder.price!, // sort by entry price from high to low
  );
}
