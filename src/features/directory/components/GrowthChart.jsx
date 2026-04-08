import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatLongDate, formatMonthTick, formatNumber } from "../utils";

export function GrowthChart({ growth }) {
  const [activeMetric, setActiveMetric] = useState("total");
  const points = growth?.series || [];
  const metricOptions = [
    { id: "total", label: "Total Listed", accent: "#67e8f9" },
    { id: "rolling_avg_net_7d", label: "7d Growth Avg", accent: "#f59e0b" },
    { id: "net", label: "Daily Net Change", accent: "#34d399" },
  ];
  const chartConfig = {
    total: {
      label: "Total Listed",
      color: "#67e8f9",
    },
    rolling_avg_net_7d: {
      label: "7d Growth Avg",
      color: "#f59e0b",
    },
    net: {
      label: "Daily Net Change",
      color: "#34d399",
    },
  };
  const activeMetricOption = metricOptions.find((option) => option.id === activeMetric) || metricOptions[0];

  if (!points.length) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/55 p-5 text-sm text-muted-foreground">
        Growth history is not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-card/55 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {metricOptions.map((option) => {
          const selected = option.id === activeMetric;
          return (
            <Button
              key={option.id}
              type="button"
              variant={selected ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setActiveMetric(option.id)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/70 bg-background/40 p-2 sm:p-3">
        <ChartContainer
          config={chartConfig}
          className="h-[20rem] w-full sm:h-[23rem]"
        >
          <ComposedChart
            accessibilityLayer
            data={points}
            margin={{ top: 12, right: 10, bottom: 12, left: 8 }}
          >
            <defs>
              <linearGradient id="fill-active-metric" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={activeMetricOption.accent}
                  stopOpacity={0.28}
                />
                <stop
                  offset="100%"
                  stopColor={activeMetricOption.accent}
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
              tickLine={false}
              axisLine={false}
              width={44}
              tickMargin={10}
              tickFormatter={(value) =>
                activeMetric === "rolling_avg_net_7d"
                  ? Number(value).toFixed(1)
                  : formatNumber(Math.round(value))
              }
            />
            {activeMetric !== "total" ? (
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="5 5" />
            ) : null}
            <ChartTooltip
              cursor={{ stroke: activeMetricOption.accent, strokeDasharray: "4 4", strokeOpacity: 0.4 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatLongDate(value)}
                  formatter={(value) =>
                    activeMetric === "rolling_avg_net_7d"
                      ? Number(value || 0).toFixed(2)
                      : formatNumber(value)
                  }
                />
              }
            />
            <Area
              type="monotone"
              dataKey={activeMetric}
              stroke="none"
              fill="url(#fill-active-metric)"
              fillOpacity={1}
            />
            <Line
              type="monotone"
              dataKey={activeMetric}
              stroke={`var(--color-${activeMetric})`}
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                fill: `var(--color-${activeMetric})`,
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  );
}
