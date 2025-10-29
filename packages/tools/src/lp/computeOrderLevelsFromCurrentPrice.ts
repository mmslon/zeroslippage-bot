import type { IGridBotLevel, IOrderCandidate, IPlaceOrderRequest } from "@opentrader/types";
import { XOrderStatus } from "@opentrader/types";

/**
 * Computes initial grid levels based on current asset price.
 *
 * @param orderLevels - Number of grid levels
 * @param minOrderAmount - Minimum order amount
 * @param maxOrderAmount - Maximum order amount
 * @param initialSpread - Initial spread from current price (as decimal, e.g., 0.01 = 1%)
 * @param stepSpread - Spread increment for each level (as decimal, e.g., 0.01 = 1%)
 * @param currentAssetPrice - Current asset price
 * @param pricePrecision - Number of decimal places for price
 * @returns Array of order candidates
 */
export function computeOrderLevelsFromCurrentPrice(
  orderLevels: number,
  minOrderAmount: number,
  maxOrderAmount: number,
  initialSpread: number,
  stepSpread: number,
  currentAssetPrice: number,
  pricePrecision: number,
): IOrderCandidate[] {
  const orders: IOrderCandidate[] = [];

  for (let i = 0; i < orderLevels; i++) {
    // Generate random quantity between min and max
    const quantity = Math.random() * (maxOrderAmount - minOrderAmount) + minOrderAmount;

    // Calculate spread (already in decimal format)
    const spreadDecimal = initialSpread + i * stepSpread;

    // Calculate prices with spread
    const sellPrice = currentAssetPrice * (1 + spreadDecimal);
    const buyPrice = currentAssetPrice * (1 - spreadDecimal);

    // Round prices to specified precision
    const roundedSellPrice = Number(sellPrice.toFixed(pricePrecision));
    const roundedBuyPrice = Number(buyPrice.toFixed(pricePrecision));

    orders.push({
      side: "Sell",
      type: "Limit",
      price: roundedSellPrice,
      quantity,
    });

    orders.push({
      side: "Buy",
      type: "Limit",
      price: roundedBuyPrice,
      quantity,
    });
  }

  return orders;
}
