import type { IGridBotLevel } from "@opentrader/types";
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
): IGridBotLevel[] {
  const gridLevels: IGridBotLevel[] = [];

  for (let i = 0; i < orderLevels; i++) {
    const quantity = minOrderAmount;
    const sellPrice = currentAssetPrice + initialSpread + i * stepSpread;
    const buyPrice = currentAssetPrice - initialSpread - i * stepSpread;

    const gridLevel: IGridBotLevel = {
      buy: {
        price: buyPrice,
        quantity,
        status: XOrderStatus.Idle,
      },
      sell: {
        price: sellPrice,
        quantity,
        status: XOrderStatus.Idle,
      },
    };
    gridLevels.push(gridLevel);
  }

  return gridLevels;
}
