import type { PrismaClient } from "@prisma/client";

export const smartTradeModel = (prisma: PrismaClient) => ({
  async clearRef(id: number) {
    return prisma.smartTrade.update({
      where: { id },
      data: { ref: null },
    });
  },
  async setRef(id: number, ref: string | null) {
    return prisma.smartTrade.update({
      where: {
        id,
      },
      data: {
        ref,
      },
    });
  },
  async findByExchangeOrderId(exchangeOrderId: string) {
    return prisma.smartTrade.findFirst({
      where: {
        orders: {
          some: {
            exchangeOrderId,
          },
        },
      },
      include: {
        orders: true,
      },
    });
  },
});
