import type { ICandlestick } from "@opentrader/types";

const pad = (value: string | number, length: number) =>
  value.toString().padEnd(length);

export function candle({ open, high, low, close }: ICandlestick) {
  const O = "O";
  const H = "H";
  const L = "L";
  const C = "C";

  return `${O} ${open} ${H} ${high} ${L} ${low} ${C} ${close}`;
}

export function datetime(timestamp: number | Date, resetSeconds = false) {
  const pad = (number: number) => number.toString().padStart(2, "0");

  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = resetSeconds ? "00" : pad(date.getSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function candletime(dateOrTimestamp: Date | number) {
  return datetime(dateOrTimestamp, true);
}
