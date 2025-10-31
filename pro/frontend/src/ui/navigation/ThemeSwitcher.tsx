"use client";

import { useEffect, useState } from "react";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import BedtimeOutlinedIcon from "@mui/icons-material/BedtimeOutlined";
import { useColorScheme } from "@mui/joy/styles";
import IconButton from "@mui/joy/IconButton";

export function ThemeSwitcher() {
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);

  // necessary for server-side rendering
  // because mode is undefined on the server
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return null;
  }

  return (
    <IconButton
      onClick={() => {
        setMode(mode === "light" ? "dark" : "light");
      }}
      variant="outlined"
    >
      {mode === "light" ? <BedtimeOutlinedIcon /> : <LightModeOutlinedIcon />}
    </IconButton>
  );
}
