import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatLongDate, formatMonthTick, formatNumber } from "../utils";

function formatCompactTick(value, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: fractionDigits,
  }).format(value ?? 0);
}

export function GrowthChart({ growth }) {
  const points = growth?.series || [];
  const chartConfig = {
    total: {
      label: "Total Listed",
      color: "#67e8f9",
    },
  };
  const maxTotal = Math.max(...points.map((point) => point.total || 0), 1);
  const yAxisTicks = Array.from(
    { length: Math.floor(Math.log10(maxTotal)) + 1 },
    (_, exponent) => 10 ** exponent,
  );

  if (!points.length) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/55 p-5 text-sm text-muted-foreground">
        Growth history is not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl border border-border/70 bg-background/40 p-2 sm:p-3">
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 px-8 text-center">
          <div className="text-sm text-foreground">
            Total listed extensions over time
          </div>
        </div>
        <ChartContainer
          config={chartConfig}
          className="h-[20rem] w-full sm:h-[23rem]"
        >
          <ComposedChart
            accessibilityLayer
            data={points}
            margin={{ top: 36, right: 10, bottom: 12, left: 8 }}
          >
            <defs>
              <linearGradient id="fill-active-metric" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="#67e8f9"
                  stopOpacity={0.28}
                />
                <stop
                  offset="100%"
                  stopColor="#67e8f9"
                  stopOpacity={0.03}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              minTickGap={28}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={formatMonthTick}
            />
            <YAxis
              type="number"
              scale="log"
              domain={[1, maxTotal]}
              ticks={yAxisTicks}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              width={56}
              tickMargin={10}
              tickFormatter={(value) => formatCompactTick(Math.round(value), 1)}
            />
            <ChartTooltip
              cursor={{ stroke: "#67e8f9", strokeDasharray: "4 4", strokeOpacity: 0.4 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatLongDate(value)}
                  formatter={(value) => formatNumber(value)}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="none"
              fill="url(#fill-active-metric)"
              fillOpacity={1}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                fill: "var(--color-total)",
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  );
}
