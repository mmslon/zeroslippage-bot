import type { IExchange } from "@opentrader/exchanges";
import type {
  IAccountAsset,
  IGetTradingFeeRatesRequest,
  IGetTradingFeeRatesResponse,
  IGetCandlesticksRequest,
  ICandlestick,
  IGetMarketPriceRequest,
  IGetMarketPriceResponse,
  ICancelLimitOrderRequest,
  ICancelLimitOrderResponse,
  IPlaceOrderRequest,
  IPlaceOrderResponse,
  IPlaceLimitOrderRequest,
  IPlaceLimitOrderResponse,
  IPlaceMarketOrderRequest,
  IPlaceMarketOrderResponse,
  IPlaceStopOrderRequest,
  IPlaceStopOrderResponse,
  IGetLimitOrderRequest,
  IGetLimitOrderResponse,
  IGetSymbolInfoRequest,
  ISymbolInfo,
  IWatchOrdersRequest,
  IWatchOrdersResponse,
  IWatchCandlesRequest,
  IWatchCandlesResponse,
  ITrade,
  IOrderbook,
  ITicker,
} from "@opentrader/types";
import { ExchangeCode } from "@opentrader/types";
import type { MarketSimulator } from "../market-simulator.js";

export class MemoryExchange implements IExchange {
  ccxt = {} as any;
  exchangeCode = ExchangeCode.OKX;
  isPaper = false;
  isDemo = false;

  /**
   * @internal
   */
  constructor(private marketSimulator: MarketSimulator) {}

  async destroy() {}

  async loadMarkets() {
    return {};
  }

  async accountAssets(): Promise<IAccountAsset[]> {
    return [];
  }

  async getLimitOrder(data: IGetLimitOrderRequest): Promise<IGetLimitOrderResponse> {
    return {
      symbol: data.symbol,
      exchangeOrderId: "",
      clientOrderId: "",
      price: 0,
      quantity: 1,
      quantityExecuted: 1,
      volume: 0,
      volumeExecuted: 0,
      side: "buy",
      status: "filled",
      fee: 0,
      createdAt: 0,
      lastTradeTimestamp: 0,
      filledPrice: null,
    };
  }

  async placeOrder(_body: IPlaceOrderRequest): Promise<IPlaceOrderResponse> {
    return {
      orderId: "",
      clientOrderId: "",
    };
  }

  async placeLimitOrder(_body: IPlaceLimitOrderRequest): Promise<IPlaceLimitOrderResponse> {
    return {
      orderId: "",
      clientOrderId: "",
    };
  }

  async placeMarketOrder(_body: IPlaceMarketOrderRequest): Promise<IPlaceMarketOrderResponse> {
    return {
      orderId: "",
      clientOrderId: "",
    };
  }

  async placeStopOrder(_body: IPlaceStopOrderRequest): Promise<IPlaceStopOrderResponse> {
    return {
      orderId: "",
      clientOrderId: "",
    };
  }

  async cancelLimitOrder(_body: ICancelLimitOrderRequest): Promise<ICancelLimitOrderResponse> {
    return {
      orderId: "",
    };
  }

  async getTicker(symbol: string): Promise<ITicker> {
    const candlestick = this.marketSimulator.currentCandle;
    const assetPrice = candlestick.close;

    return {
      symbol,
      bid: assetPrice,
      ask: assetPrice,
      last: assetPrice,
      baseVolume: 0,
      quoteVolume: 0,
      timestamp: this.marketSimulator.currentCandle.timestamp,
    };
  }

  async getOrderbook(symbol: string): Promise<IOrderbook> {
    return {
      symbol,
      timestamp: Date.now(),
      bids: [],
      asks: [],
    };
  }

  async getMarketPrice(params: IGetMarketPriceRequest): Promise<IGetMarketPriceResponse> {
    const candlestick = this.marketSimulator.currentCandle;
    const assetPrice = candlestick.close;
    const { symbol } = params;

    return {
      symbol,
      price: assetPrice,
      timestamp: 0,
    };
  }

  async getCandlesticks(_params: IGetCandlesticksRequest): Promise<ICandlestick[]> {
    return [];
  }

  async getTradingFeeRates(_params: IGetTradingFeeRatesRequest): Promise<IGetTradingFeeRatesResponse> {
    return {
      makerFee: 0,
      takerFee: 0,
    };
  }

  async getSymbol(_params: IGetSymbolInfoRequest): Promise<ISymbolInfo> {
    return {
      symbolId: `${ExchangeCode.OKX}:ADA/USDT`,
      currencyPair: "ADA/USDT",
      exchangeCode: ExchangeCode.OKX,
      exchangeSymbolId: "ADA-USDT",
      baseCurrency: "ADA",
      quoteCurrency: "USDT",
      filters: {
        precision: {
          amount: 1,
          price: 0.01,
        },
        decimals: {
          amount: 0,
          price: 2,
        },
        limits: {
          amount: {
            min: 1,
            max: 10000,
          },
          cost: {
            min: 0.01,
            max: 100000,
          },
          leverage: {
            min: 1,
            max: 100,
          },
          price: {
            min: 0.01,
            max: 100000,
          },
        },
      },
    };
  }

  async getSymbols(): Promise<ISymbolInfo[]> {
    return [];
  }

  async getOpenOrders() {
    return [];
  }

  async getClosedOrders() {
    return [];
  }

  async watchOrders(_params?: IWatchOrdersRequest): Promise<IWatchOrdersResponse> {
    throw new Error("Not implemented. Backtesting doesn't require this method.");
  }

  async watchCandles(_params?: IWatchCandlesRequest): Promise<IWatchCandlesResponse> {
    throw new Error("Not implemented. Backtesting doesn't require this method.");
  }

  async watchTrades(): Promise<ITrade[]> {
    throw new Error("Not implemented. Backtesting doesn't require this method.");
  }

  async watchOrderbook(): Promise<IOrderbook> {
    throw new Error("Not implemented. Backtesting doesn't require this method.");
  }

  async watchTicker(): Promise<ITicker> {
    throw new Error("Not implemented. Backtesting doesn't require this method.");
  }
}
