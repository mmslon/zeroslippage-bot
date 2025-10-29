// Only for testing purposes. Don't export this file.
import type { ExchangeAccountWithCredentials, SmartTradeWithOrders } from "@opentrader/db";
import { xprisma } from "@opentrader/db";
import { Prisma } from "@prisma/client";
import type { XEntityType, XOrderSide, XOrderStatus, XOrderType } from "@opentrader/types";

export const TEST_ACCOUNT_LABEL = "TEST";

type OrderParams = {
  type: XOrderType;
  side: XOrderSide;
  price: number;
  quantity: number;
};

type CreateTradeParams = {
  symbol: string;
  entry: OrderParams;
  takeProfit?: OrderParams;
};

export async function createTrade(
  params: CreateTradeParams,
  exchangeLabel = TEST_ACCOUNT_LABEL,
): Promise<SmartTradeWithOrders> {
  const { symbol, entry, takeProfit } = params;

  const exchangeAccount = await xprisma.exchangeAccount.findFirstOrThrow({
    where: {
      label: exchangeLabel,
    },
  });

  // @todo Array
  const orders: Prisma.OrderCreateManySmartTradeInput[] = [];
  orders.push({
    ...entry,
    symbol,
    entityType: "EntryOrder",
    exchangeAccountId: exchangeAccount.id,
  });
  if (takeProfit) {
    orders.push({
      ...takeProfit,
      symbol,
      entityType: "TakeProfitOrder",
      exchangeAccountId: exchangeAccount.id,
    });
  }

  return xprisma.smartTrade.create({
    data: {
      entryType: "Order",
      takeProfitType: "Order",

      ref: null,
      type: "Trade",
      symbol,

      orders: {
        createMany: {
          data: orders,
        },
      },

      exchangeAccount: {
        connect: {
          id: exchangeAccount.id,
        },
      },

      owner: {
        connect: {
          id: exchangeAccount.ownerId,
        },
      },
    },
    include: {
      exchangeAccount: true,
      orders: true,
    },
  });
}

export async function getExchangeAccount(label = TEST_ACCOUNT_LABEL): Promise<ExchangeAccountWithCredentials> {
  return xprisma.exchangeAccount.findFirstOrThrow({
    where: {
      label,
    },
  });
}

type UpdateOrderParams = {
  price?: number;
  filledPrice?: number;
  filledAt?: Date;
  quantity?: number;
  status?: XOrderStatus;
};

export async function updateOrder(params: UpdateOrderParams, trade: SmartTradeWithOrders, entityType: XEntityType) {
  const entryOrder = trade.orders.find((order) => order.entityType === "EntryOrder");

  if (!entryOrder) {
    throw new Error("Entry order not found");
  }

  return xprisma.order.update({
    where: {
      id: entryOrder.id,
    },
    data: {
      ...params,
    },
  });
}

export async function updateEntryOrder(params: UpdateOrderParams, trade: SmartTradeWithOrders) {
  return updateOrder(params, trade, "EntryOrder");
}

export async function updateTakeProfitOrder(params: UpdateOrderParams, trade: SmartTradeWithOrders) {
  return updateOrder(params, trade, "TakeProfitOrder");
}
