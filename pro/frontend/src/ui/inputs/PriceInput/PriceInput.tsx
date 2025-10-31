import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import type { InputProps } from "@mui/joy/Input";
import Input from "@mui/joy/Input";
import type { FC } from "react";
import React from "react";
import type { ISymbolFilter } from "@opentrader/types";
import { NumericInput } from "src/ui/inputs/NumericInput";
import { mapPriceFilterToNumericFormatProps } from "./helpers/mapPriceFilterToNumericFormatProps";
import { validatePriceByFilter } from "./helpers/validatePriceByFilter";

type PriceInputProps = Omit<InputProps, "value" | "onChange" | "slotProps"> & {
  filter: ISymbolFilter;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
};

export const PriceInput: FC<PriceInputProps> = (props) => {
  const { value, onChange, filter, label, ...InputProps } = props;

  const formatProps = mapPriceFilterToNumericFormatProps(filter);
  const errorMessage = validatePriceByFilter(value, filter);

  return (
    <FormControl error={!!errorMessage}>
      <FormLabel>{label}</FormLabel>

      <Input
        onChange={onChange}
        slotProps={{
          input: {
            component: NumericInput,
            NumericFormatProps: formatProps,
          },
        }}
        value={value}
        {...InputProps}
      />

      {errorMessage ? <FormHelperText>{errorMessage}</FormHelperText> : null}
    </FormControl>
  );
};
