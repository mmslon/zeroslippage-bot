import type { IExchange } from "@opentrader/exchanges";
import { XOrderSide, XOrderStatus, XOrderType } from "@opentrader/types";
import type { Order } from "@prisma/client";
import { logger } from "@opentrader/logger";
import type { OrderEntity } from "@opentrader/db";
import { assertHasExchangeOrderId, toOrderEntity, xprisma } from "@opentrader/db";
import { OrderNotFound } from "ccxt";

export class OrderExecutor {
  order: OrderEntity;
  exchange: IExchange;
  symbol: string; // maybe migrate Order schema to support symbol

  constructor(order: Order, exchange: IExchange, symbol: string) {
    this.order = toOrderEntity(order);
    this.exchange = exchange;
    this.symbol = symbol;
  }

  static async fromId(id: number, exchange: IExchange, symbol: string) {
    const order = await xprisma.order.findUniqueOrThrow({
      where: {
        id,
      },
    });

    return new OrderExecutor(toOrderEntity(order), exchange, symbol);
  }

  /**
   * Places the order on the exchange and updates the status in the database.
   * Returns `true` if the order was placed successfully.
   */
  async place(): Promise<boolean> {
    if (this.order.status !== "Idle") {
      logger.error(
        `Cannot place the order: Order { id: ${this.order.id}, status: ${this.order.status} }. Order was already placed before. Skip execution.`,
      );

      return false;
    }

    if (this.order.type === "Limit") {
      const exchangeOrder = await this.exchange.placeLimitOrder({
        symbol: this.symbol,
        side: this.order.side === "Buy" ? "buy" : "sell",
        price: this.order.price,
        quantity: this.order.quantity,
      });

      await xprisma.order.update({
        where: {
          id: this.order.id,
        },
        data: {
          status: "Placed",
          exchangeOrderId: exchangeOrder.orderId,
          placedAt: new Date(), // maybe use Exchange time (if possible)
        },
      });
      await this.pullOrder();

      return true;
    } else if (this.order.type === "Market") {
      // Some exchanges require price for Market orders.
      // https://docs.ccxt.com/#/?id=market-buys
      const marketBuyRequiresPrice: boolean | undefined =
        this.exchange.ccxt.features?.spot?.createOrder?.marketBuyRequiresPrice;

      /**
       * Estimates the price for a market order based on the current ticker.
       * Additionally, a slippage multiplier is applied to the best bid or ask price to
       * guarantee the order fulfillment on the exchange.
       */
      const estimateMarketOrderPrice = async () => {
        const MAX_PRICE_SLIPPAGE = 0.01; // 1%

        try {
          const ticker = await this.exchange.getTicker(this.symbol);
          const estimatedPrice =
            this.order.side === XOrderSide.Buy
              ? ticker.ask + ticker.ask * MAX_PRICE_SLIPPAGE
              : ticker.bid - ticker.bid * MAX_PRICE_SLIPPAGE;
          logger.debug(
            `${this.exchange.exchangeCode} requires a price for market orders. The estimated price for ${this.symbol} is ${estimatedPrice}.`,
          );

          return estimatedPrice;
        } catch (err) {
          logger.warn(err, `Failed to estimate market order price. Reason: Cannot retrieve ticker for ${this.symbol}.`);

          return undefined;
        }
      };

      const side = this.order.side === XOrderSide.Buy ? "buy" : "sell";
      const exchangeOrder = await this.exchange.placeOrder({
        type: XOrderType.Market,
        symbol: this.symbol,
        side,
        quantity: this.order.quantity,
        notional: this.order.quantity,
        price: marketBuyRequiresPrice && side === "buy" ? await estimateMarketOrderPrice() : undefined,
      });

      await xprisma.order.update({
        where: {
          id: this.order.id,
        },
        data: {
          status: "Placed",
          exchangeOrderId: exchangeOrder.orderId,
          placedAt: new Date(), // maybe use Exchange time (if possible)
        },
      });
      await this.pullOrder();

      return true;
    } else {
      throw new Error(`Unsupported order type`);
    }
  }

  /**
   * Cancels the current order and replace a new order with new price.
   */
  async modify(newOrder: Order): Promise<boolean> {
    await this.cancel();

    const order = await xprisma.order.update({
      where: { id: newOrder.id },
      data: {
        ...newOrder,
        status: XOrderStatus.Idle,
      },
    });
    this.order = toOrderEntity(order);

    return this.place();
  }

  /**
   * Returns true if the order was canceled successfully.
   */
  async cancel(): Promise<boolean> {
    if (["Canceled", "Revoked", "Deleted"].includes(this.order.status)) {
      logger.warn(
        `Cannot cancel already canceled order: Order { id: ${this.order.id}, status: ${this.order.status} }. Skip execution.`,
      );

      return false;
    }

    if (this.order.status === "Idle") {
      await xprisma.order.updateStatus("Revoked", this.order.id);
      await this.pullOrder();

      logger.info(`Order was canceled (Idle → Revoked): Order { id: ${this.order.id}, status: ${this.order.status} }`);

      return true;
    }

    if (this.order.status === "Placed") {
      assertHasExchangeOrderId(this.order);

      try {
        await this.exchange.cancelLimitOrder({
          orderId: this.order.exchangeOrderId,
          symbol: this.symbol,
        });
        await xprisma.order.updateStatus("Canceled", this.order.id);
        await this.pullOrder();

        logger.info(
          `Order was canceled (Placed → Canceled): Order { id: ${this.order.id}, status: ${this.order.status} }`,
        );

        return true;
      } catch (err) {
        if (err instanceof OrderNotFound) {
          await xprisma.order.updateStatus("Deleted", this.order.id);
          await this.pullOrder();

          logger.warn(
            `Order was canceled (Placed → Deleted). Attempted to cancel order that was not found on exchange: Order { id: ${this.order.id} }. Marked as Deleted.`,
          );

          return true;
        }
        logger.error(
          {
            err,
            order: this.order,
          },
          `Unexpected error occurred while canceling order: Order { id: ${this.order.id} }`,
        );
        throw err; // @todo retry
      }
    }

    if (this.order.status === "Filled") {
      await this.pullOrder();

      logger.debug(
        `Cannot cancel order because it is already Filled: Order { id: ${this.order.id}, status: ${this.order.status}.`,
      );

      return false;
    }

    return false;
  }

  /**
   * Pulls the order from the database to update the status.
   */
  private async pullOrder() {
    const order = await xprisma.order.findUniqueOrThrow({
      where: {
        id: this.order.id,
      },
    });

    this.order = toOrderEntity(order);
  }

  get type() {
    return this.order.type;
  }

  get status() {
    return this.order.status;
  }

  get price() {
    return this.order.price;
  }

  get filledPrice() {
    return this.order.filledPrice;
  }

  get filledAt() {
    return this.order.filledAt;
  }

  get placedAt() {
    return this.order.placedAt;
  }
}
