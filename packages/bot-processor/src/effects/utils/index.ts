import type { BaseEffect, EffectType } from "../types/index.js";

export const makeEffect = <T extends EffectType, P = undefined, R = undefined>(
  type: T,
  payload: P,
  ref: R,
): BaseEffect<T, P, R> => {
  return {
    ref,
    type,
    payload,
  };
};

export function isEffect<T extends EffectType, P = undefined, R = undefined>(
  effect: unknown,
): effect is BaseEffect<T, P, R> {
  return !!(effect as BaseEffect<any>)?.type;
}

export function isNestedGenerator(value: unknown): value is Generator {
  return typeof (value as Generator)?.next === "function";
}
