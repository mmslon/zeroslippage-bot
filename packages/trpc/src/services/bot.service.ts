import type { TBotWithExchangeAccount } from "@opentrader/db";
import { xprisma } from "@opentrader/db";
import { TRPCError } from "@trpc/server";

export class BotService {
  constructor(public bot: TBotWithExchangeAccount) {}

  static async fromId(id: number) {
    const bot = await xprisma.bot.custom.findUniqueOrThrow({
      where: {
        id,
      },
      include: {
        exchangeAccount: true,
      },
    });

    return new BotService(bot);
  }

  static async fromSmartTradeId(smartTradeId: number) {
    const bot = await xprisma.bot.custom.findFirstOrThrow({
      where: {
        smartTrades: {
          some: {
            id: smartTradeId,
          },
        },
      },
      include: {
        exchangeAccount: true,
      },
    });

    return new BotService(bot);
  }

  async start() {
    this.bot = await xprisma.bot.custom.update({
      where: {
        id: this.bot.id,
      },
      data: {
        enabled: true,
      },
      include: {
        exchangeAccount: true,
      },
    });
  }

  async stop() {
    this.bot = await xprisma.bot.custom.update({
      where: {
        id: this.bot.id,
      },
      data: {
        enabled: false,
      },
      include: {
        exchangeAccount: true,
      },
    });
  }

  assertIsRunning() {
    if (!this.bot.enabled) {
      throw new TRPCError({
        message: "Bot is not enabled",
        code: "CONFLICT",
      });
    }
  }

  assertIsNotAlreadyRunning() {
    if (this.bot.enabled) {
      throw new TRPCError({
        message: "Bot already running. Please stop the bot first.",
        code: "CONFLICT",
      });
    }
  }

  assertIsNotAlreadyStopped() {
    if (!this.bot.enabled) {
      throw new TRPCError({
        message: "Bot already stopped",
        code: "CONFLICT",
      });
    }
  }

  /**
   * @deprecated
   */
  assertIsNotProcessing() {
    if (this.bot.processing) {
      throw new TRPCError({
        message: "The bot is busy with the previous processing job",
        code: "CONFLICT",
      });
    }
  }
}
