"use client";

import type { FC } from "react";
import React from "react";
import { computeInvestmentAmount, decomposeSymbolId } from "@opentrader/tools";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import { tClient } from "src/lib/trpc/client";
import { selectGridLines, selectSymbolId } from "src/store/bot-form/selectors";
import { useAppSelector } from "src/store/hooks";
import { InvestmentFieldHelperText } from "./InvestmentFieldHelperText";

type InvestmentFieldProps = {
  className?: string;
};

export const InvestmentField: FC<InvestmentFieldProps> = (props) => {
  const { className } = props;

  const symbolId = useAppSelector(selectSymbolId);
  const { quoteCurrency } = decomposeSymbolId(symbolId);

  const [currentAssetPrice] = tClient.symbol.price.useSuspenseQuery({
    symbolId,
  });
  const [symbol] = tClient.symbol.getOne.useSuspenseQuery({
    symbolId,
  });

  const gridLines = useAppSelector(selectGridLines);

  const { baseCurrencyAmount, quoteCurrencyAmount, totalInQuoteCurrency } =
    computeInvestmentAmount(symbol, gridLines, currentAssetPrice.price);

  const inputId = "investment-field";
  const label = "Investment";

  return (
    <FormControl className={className}>
      <FormLabel htmlFor={inputId}>{label}</FormLabel>

      <Input
        disabled
        endDecorator={<>{quoteCurrency}</>}
        id={inputId}
        type="number"
        value={totalInQuoteCurrency}
      />

      <InvestmentFieldHelperText
        baseCurrencyAmount={baseCurrencyAmount}
        quoteCurrencyAmount={quoteCurrencyAmount}
        totalInQuoteCurrency={totalInQuoteCurrency}
      />
    </FormControl>
  );
};
