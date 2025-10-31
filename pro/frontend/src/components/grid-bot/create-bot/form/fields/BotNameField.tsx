"use client";

import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import type { FC } from "react";
import React, { useEffect, useState } from "react";
import ReplayIcon from "@mui/icons-material/Replay";
import { changeBotName } from "src/store/bot-form";
import { selectBotName } from "src/store/bot-form/selectors";
import { useAppDispatch, useAppSelector } from "src/store/hooks";
import { generateBotName } from "src/utils/bot-name-generator";

export const BotNameField: FC = () => {
  const dispatch = useAppDispatch();

  const reduxValue = useAppSelector(selectBotName);
  const [value, setValue] = useState(reduxValue);
  useEffect(() => {
    setValue(`${reduxValue}`);
  }, [reduxValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleBlur = () => {
    if (value.length > 0) {
      dispatch(changeBotName(value));
    } else {
      setValue(reduxValue);
    }
  };

  const regenerateBotName = () => {
    dispatch(changeBotName(generateBotName()));
  };

  const errorMessage = value.length === 0 ? "Must be defined" : null;

  return (
    <FormControl error={!!errorMessage}>
      <FormLabel>Bot name</FormLabel>

      <Input
        endDecorator={
          <IconButton onClick={regenerateBotName}>
            <ReplayIcon />
          </IconButton>
        }
        onBlur={handleBlur}
        onChange={handleChange}
        value={value}
      />

      {errorMessage ? <FormHelperText>{errorMessage}</FormHelperText> : null}
    </FormControl>
  );
};
