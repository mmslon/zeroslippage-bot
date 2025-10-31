import React from "react";
import Button from "@mui/joy/Button";
import Grid from "@mui/joy/Grid";
import NextLink from "next/link";
import { toPage } from "src/utils/next/toPage";
import { BotListSkeleton } from "./BotListSkeleton";

export default function Loading() {
  return (
    <Grid container spacing={4}>
      <Grid xs={12}>
        <Button component={NextLink} href={toPage("grid-bot/create")} size="lg">
          Create new bot
        </Button>
      </Grid>

      <Grid xs={12}>
        <BotListSkeleton />
      </Grid>
    </Grid>
  );
}
