"use client";

import type { FC, ReactNode } from "react";
import React, { useState } from "react";
import type { ExchangeCode } from "@opentrader/types";
import Autocomplete, { createFilterOptions } from "@mui/joy/Autocomplete";
import { tClient } from "src/lib/trpc/client";
import type { TSymbol } from "src/types/trpc";
import { ListboxComponent } from "./LisboxComponent";
import { renderOption } from "./renderOption";

export type CryptoCoinSelectProps = {
  exchangeCode: ExchangeCode;
  value: TSymbol | null;
  onChange: (value: TSymbol | null) => void;
  defaultSymbols?: TSymbol[];
};

const getOptionLabel = (symbol: TSymbol) => symbol.currencyPair;

const filterOptions = createFilterOptions<TSymbol>({
  matchFrom: "start",
  stringify: (option) => option.currencyPair.replace("/", ""),
});

export const SymbolSelect: FC<CryptoCoinSelectProps> = ({
  exchangeCode,
  value,
  onChange,
  defaultSymbols,
}) => {
  const [inputValue, setInputValue] = useState(
    value ? getOptionLabel(value) : "",
  );

  const [data] = defaultSymbols
    ? [defaultSymbols]
    : tClient.symbol.list.useSuspenseQuery(exchangeCode);

  return (
    <Autocomplete
      autoHighlight
      disableClearable
      disableListWrap
      filterOptions={filterOptions}
      getOptionLabel={getOptionLabel}
      inputValue={inputValue}
      onChange={(_e, value) => onChange(value)}
      onInputChange={(_e, value) => setInputValue(value)}
      options={data}
      renderOption={(...props) => renderOption(...props) as ReactNode}
      slots={{
        listbox: ListboxComponent,
      }}
      // Actually it doesn't return ReactNode, but an array
      // with: option's `HTMLElement`, option data, `state` and `ownerState`.
      // Check `renderOption()` params for more details.
      // To make TS happy the return type will be marked as ReactNode.
      value={value || undefined} // @todo add `required` prop
    />
  );
};

SymbolSelect.displayName = "SymbolSelect";
