import { useMemo, useState } from "react";
import type { ChartView } from "./metric-controls";

export type { ChartView };
export type MetricAccent = "sky" | "emerald" | "rose" | "neutral";
export type SeriesPoint = { value: number; date: string };
export type MetricSeries = { name: string; data: SeriesPoint[]; accent?: MetricAccent };
export type ChartSeries = { name: string; data: SeriesPoint[]; color: string };

// Shared by the card so labels and chart always use the same palette.
export const ACCENTS = {
  sky: { stroke: "#20c873", text: "#86efac" },
  emerald: { stroke: "#34d399", text: "#6ee7b7" },
  rose: { stroke: "#fb7185", text: "#fda4af" },
  neutral: { stroke: "#94a3b8", text: "#cbd5e1" },
} satisfies Record<MetricAccent, { stroke: string; text: string }>;

// eslint-disable-next-line react-refresh/only-export-components
export const SERIES_COLORS = ["#20c873", "#50e596", "#0f9f5b", "#86efac"];
// eslint-disable-next-line react-refresh/only-export-components
export const formatCompact = (value: number) =>
  Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const WIDTH = 620;
const HEIGHT = 300;
const LEFT = 28;
const RIGHT = 18;
const TOP = 96;
const BOTTOM = 72;
const plotWidth = WIDTH - LEFT - RIGHT;
const plotHeight = HEIGHT - TOP - BOTTOM;

const smoothPath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
};

export function MetricChart({
  series,
  view,
  defaultIndex,
  valueFormatter,
  dateFormatter,
}: {
  series: ChartSeries[];
  view: ChartView;
  defaultIndex?: number;
  valueFormatter: (value: number) => string;
  dateFormatter: (date: string) => string;
}) {
  const count = Math.max(...series.map((item) => item.data.length), 0);
  const [activeIndex, setActiveIndex] = useState<number | null>(
    count ? Math.min(defaultIndex ?? count - 1, count - 1) : null,
  );

  const maxValue = useMemo(
    () => Math.max(...series.flatMap((item) => item.data.map((point) => point.value)), 1),
    [series],
  );
  const xAt = (index: number) =>
    LEFT + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const yAt = (value: number) => TOP + plotHeight - (value / maxValue) * plotHeight;
  const labelEvery = Math.max(1, Math.ceil(count / 6));
  const activeDate = activeIndex === null ? null : series[0]?.data[activeIndex]?.date;

  return (
    <div className="absolute inset-0" onMouseLeave={() => setActiveIndex(null)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={`Gráfico de ${series.map((item) => item.name).join(" e ")}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = TOP + plotHeight * ratio;
          return (
            <line
              key={ratio}
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y}
              y2={y}
              stroke="rgba(125,211,252,.13)"
              strokeDasharray="4 6"
            />
          );
        })}

        {view === "curve"
          ? series.map((item) => {
              const points = item.data.map((point, index) => ({
                x: xAt(index),
                y: yAt(point.value),
              }));
              const path = smoothPath(points);
              const area = `${path} L ${points.at(-1)?.x ?? LEFT} ${TOP + plotHeight} L ${points[0]?.x ?? LEFT} ${TOP + plotHeight} Z`;
              return (
                <g key={item.name}>
                  <path d={area} fill={item.color} opacity="0.07" />
                  <path
                    d={path}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })
          : series.map((item, seriesIndex) => {
              const groupWidth = Math.max(5, Math.min(18, plotWidth / Math.max(count, 1) / 3));
              return item.data.map((point, index) => {
                const x = xAt(index) + (seriesIndex - (series.length - 1) / 2) * groupWidth;
                const y = yAt(point.value);
                return (
                  <rect
                    key={`${item.name}-${index}`}
                    x={x - groupWidth / 2}
                    y={y}
                    width={groupWidth - 2}
                    height={Math.max(2, TOP + plotHeight - y)}
                    rx="4"
                    fill={item.color}
                    opacity="0.82"
                  />
                );
              });
            })}

        {activeIndex !== null && (
          <line
            x1={xAt(activeIndex)}
            x2={xAt(activeIndex)}
            y1={TOP}
            y2={TOP + plotHeight}
            stroke="rgba(125,211,252,.35)"
            strokeDasharray="3 4"
          />
        )}

        {series[0]?.data.map((point, index) =>
          index % labelEvery === 0 || index === count - 1 ? (
            <text
              key={`${point.date}-${index}`}
              x={xAt(index)}
              y={HEIGHT - 48}
              textAnchor="middle"
              fill="#7f91a6"
              fontSize="11"
            >
              {dateFormatter(point.date)}
            </text>
          ) : null,
        )}

        {Array.from({ length: Math.max(count, 1) }).map((_, index) => {
          const cellWidth = plotWidth / Math.max(count - 1, 1);
          return (
            <rect
              key={`hit-${index}`}
              x={xAt(index) - cellWidth / 2}
              y={TOP}
              width={cellWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(Math.min(index, count - 1))}
            />
          );
        })}
      </svg>

      {activeIndex !== null && activeDate && (
        <div
          className={`pointer-events-none absolute z-20 min-w-32 rounded-lg border border-primary/25 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur ${activeIndex >= count - 2 ? "-translate-x-full" : activeIndex <= 1 ? "translate-x-0" : "-translate-x-1/2"}`}
          style={{
            left: `${(xAt(activeIndex) / WIDTH) * 100}%`,
            top: `${((TOP - 8) / HEIGHT) * 100}%`,
          }}
        >
          <p className="mb-1.5 font-semibold text-foreground">{dateFormatter(activeDate)}</p>
          {series.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-4 text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
              <span className="font-medium text-foreground">
                {valueFormatter(item.data[activeIndex]?.value ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
