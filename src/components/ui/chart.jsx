"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

const ChartContext = React.createContext(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

function ChartContainer({ id, className, children, config, ...props }) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }) {
  const colorConfig = Object.entries(config || {}).filter(([, value]) => value?.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
[data-chart=${id}] {
${colorConfig
  .map(([key, value]) => `  --color-${key}: ${value.color};`)
  .join("\n")}
}
        `,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  labelFormatter,
  formatter,
}) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const tooltipLabel = labelFormatter
    ? labelFormatter(payload[0]?.payload?.date, payload)
    : payload[0]?.payload?.date;

  return (
    <div
      className={cn(
        "grid min-w-[12rem] gap-2 rounded-xl border border-border/70 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur",
        className,
      )}
    >
      {tooltipLabel ? (
        <div className="font-medium text-foreground">{tooltipLabel}</div>
      ) : null}

      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = item.dataKey;
          const itemConfig = key ? config?.[key] : null;

          return (
            <div key={item.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full",
                    indicator === "dot" ? "size-2.5" : "h-2.5 w-6",
                  )}
                  style={{
                    backgroundColor: item.color,
                  }}
                />
                <span>{itemConfig?.label || item.name || item.dataKey}</span>
              </div>
              <div className="font-medium tabular-nums text-foreground">
                {formatter
                  ? formatter(item.value, item.name, item, payload)
                  : item.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
