import { xprisma } from "@opentrader/db";
import type { Context } from "../../../../utils/context.js";

type Options = {
  ctx: {
    user: NonNullable<Context["user"]>;
  };
};

export async function getDcaBots({ ctx }: Options) {
  const bots = await xprisma.bot.dca.findMany({
    where: {
      owner: {
        id: ctx.user.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return bots;
}
