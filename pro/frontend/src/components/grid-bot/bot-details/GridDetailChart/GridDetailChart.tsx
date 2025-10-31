"use client";

import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import { composeSymbolId } from "@opentrader/tools";
import type { FC } from "react";
import React, { Suspense, useMemo, useState } from "react";
import type { BarSize } from "@opentrader/types";
import { tClient } from "src/lib/trpc/client";
import { Chart, CHART_HEIGHT, ChartOptions } from "src/ui/charts/Chart";
import { FlexSpacer } from "src/ui/FlexSpacer";
import { ExchangeAccountSelect } from "src/ui/selects/ExchangeAccountSelect";
import { SymbolSelect } from "src/ui/selects/SymbolSelect";
import { BarSizeSelect } from "src/ui/selects/BarSizeSelect";
import { computePriceLines } from "./utils/computePriceLines";
import { computeTradeMarkers } from "./utils/computeTradeMarkers";

const timeframes = ["1d", "4h", "1h", "5m", "1m"] as const;
export type ChartBarSize = Extract<BarSize, (typeof timeframes)[number]>;

type GridChartProps = {
  botId: number;
};

const NOOP = () => void 0;

export const GridDetailChart: FC<GridChartProps> = ({ botId }) => {
  const [bot] = tClient.gridBot.getOne.useSuspenseQuery(botId);
  const [exchangeAccount] = tClient.exchangeAccount.getOne.useSuspenseQuery(
    bot.exchangeAccountId,
  );
  const [symbol] = tClient.symbol.getOne.useSuspenseQuery({
    symbolId: composeSymbolId(
      exchangeAccount.exchangeCode,
      bot.baseCurrency,
      bot.quoteCurrency,
    ),
  });
  const [activeSmartTrades] = tClient.bot.activeSmartTrades.useSuspenseQuery({
    botId,
  });
  const [completedSmartTrades] =
    tClient.bot.completedSmartTrades.useSuspenseQuery({
      botId,
    });

  const priceLines = useMemo(
    () => computePriceLines(activeSmartTrades),
    [activeSmartTrades],
  );

  const [barSize, setBarSize] = useState<ChartBarSize>("1h");
  const [showPriceLines, setShowPriceLines] = useState(true);

  const tradeMarkers = useMemo(
    () => computeTradeMarkers(completedSmartTrades, barSize),
    [completedSmartTrades, barSize],
  );
  const [showTradeMarkers, setShowTradeMarkers] = useState(false);

  return (
    <Suspense
      fallback={
        <Skeleton
          animation="wave"
          height={CHART_HEIGHT}
          variant="rectangular"
          width="100%"
        />
      }
    >
      <Chart
        barSize={barSize}
        markers={tradeMarkers}
        priceLines={priceLines}
        showMarkers={showTradeMarkers}
        showPriceLines={showPriceLines}
        symbolId={symbol.symbolId}
      >
        <ExchangeAccountSelect onChange={NOOP} value={exchangeAccount} />

        <SymbolSelect
          exchangeCode={exchangeAccount.exchangeCode}
          onChange={NOOP}
          value={symbol}
        />

        <BarSizeSelect
          onChange={(value) => {
            setBarSize(value);
          }}
          value={barSize}
          whitelist={timeframes}
        />

        <FlexSpacer />

        <Box display="flex">
          <ChartOptions
            gridVisible={showPriceLines}
            onGridVisibleChange={setShowPriceLines}
            onTradesVisibleChange={setShowTradeMarkers}
            tradesVisible={showTradeMarkers}
          />
        </Box>
      </Chart>
    </Suspense>
  );
};
