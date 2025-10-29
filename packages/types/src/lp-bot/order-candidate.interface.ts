import { XOrderStatus } from "../common/index.js";

export interface IOrderCandidate {
  price: number;
  quantity: number;
  side: "Buy" | "Sell";
  type: "Limit" | "Market";
}
