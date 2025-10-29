import { USE_PRICE_SOURCE } from "./types/index.js";
import { makeEffect } from "./utils/index.js";

type UseSourcePayload = {
  pair: string;
  exchange: string;
};

export function usePriceSource(payload: UseSourcePayload) {
  return makeEffect(USE_PRICE_SOURCE, payload, undefined);
}
