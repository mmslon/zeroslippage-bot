import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ICandlestick } from "@opentrader/types";

import { ema } from "./ema.js";

const loadCandles = (filename: string): ICandlestick[] => {
  return JSON.parse(readFileSync(join(__dirname, `./__mocks__/${filename}`), "utf-8"));
};

describe("ema", () => {
  const candles: ICandlestick[] = loadCandles("ETH_USDT-1d-candles.json");
  const candles1h: ICandlestick[] = loadCandles("ETH_USDT-1h-candles.json");

  it("should calculate EMA", async () => {
    const result = await ema({ periods: 14 }, candles);

    expect(result).toMatchSnapshot();
  });

  it("should throw an error if there are less than 2 periods", async () => {
    await expect(ema({ periods: 1 }, candles)).rejects.toThrow("EMA requires at least 2 periods");
  });

  it("should throw an error if no candles are provided", async () => {
    await expect(ema({ periods: 14 }, [])).rejects.toThrow("No candles provided for EMA");
  });

  it("the length of EMA values must be equal to the number of candles", async () => {
    const emaValues = await ema({ periods: 14 }, candles);
    expect(emaValues.length).toBe(candles.length);

    const emaValues2 = await ema({ periods: 14 }, candles.slice(0, 1));
    expect(emaValues2.length).toBe(1);
  });

  it("should calculate EMA for 1h candles", async () => {
    const result = await ema({ periods: 14 }, candles1h);

    expect(result).toMatchSnapshot();
  });
});
