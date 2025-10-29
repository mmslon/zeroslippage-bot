import { describe, expect, it } from "vitest";
import { ETH_SYMBOL_FILTER } from "../mocks/symbols.js";
import { filterQuantity } from "./filterQuantity.js";

describe("filterQuantity", () => {
  it("should filter to stepSize", () => {
    expect(filterQuantity("0.0000012", ETH_SYMBOL_FILTER)).toBe("0.000001");
  });

  it("should remove trailing zero", () => {
    expect(filterQuantity("0.000001000", ETH_SYMBOL_FILTER)).toBe("0.000001");
  });

  it("should remove decimals points when is an integer", () => {
    expect(filterQuantity("1.00000", ETH_SYMBOL_FILTER)).toBe("1");
  });

  it("with argument type number", () => {
    expect(filterQuantity(0.0000012, ETH_SYMBOL_FILTER)).toBe("0.000001");
  });
});
