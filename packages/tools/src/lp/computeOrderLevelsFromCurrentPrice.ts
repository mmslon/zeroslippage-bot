import type { IGridBotLevel, IOrderCandidate, IPlaceOrderRequest } from "@opentrader/types";
import { XOrderStatus } from "@opentrader/types";

/**
 * Computes initial grid levels based on current asset price.
 *
 * @param gridLines - Grid lines
 * @param currentAssetPrice - Current asset price
 * @returns
 */
export function computeOrderLevelsFromCurrentPrice(
  orderLevels: number,
  minOrderAmount: number,
  maxOrderAmount: number,
  initialSpread: number,
  stepSpread: number,
  currentAssetPrice: number,
): IOrderCandidate[] {
  const orders: IOrderCandidate[] = [];

  for (let i = 0; i < orderLevels; i++) {
    const quantity = minOrderAmount;
    const sellPrice = currentAssetPrice + initialSpread + i * stepSpread;
    const buyPrice = currentAssetPrice - initialSpread - i * stepSpread;

    orders.push({
      side: "Sell",
      type: "Limit",
      price: sellPrice,
      quantity,
    });

    orders.push({
      side: "Buy",
      type: "Limit",
      price: buyPrice,
      quantity,
    });
  }

  return orders;
}
