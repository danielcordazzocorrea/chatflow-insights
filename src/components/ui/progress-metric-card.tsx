import { useId, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import {
  ACCENTS,
  formatCompact,
  MetricChart,
  SERIES_COLORS,
  type ChartSeries,
  type MetricAccent,
  type MetricSeries,
  type SeriesPoint,
} from "./metric-chart";
import { PeriodSelect, ViewToggle, type ChartView, type PeriodOption } from "./metric-controls";

export type { SeriesPoint, MetricSeries, MetricAccent, ChartView, PeriodOption };
export type CardSize = "sm" | "md" | "lg";
export interface ProgressMetricCardProps {
  title: string;
  total?: string | number;
  delta?: string;
  deltaLabel?: string;
  percent?: string;
  trend?: "up" | "down";
  unit?: string;
  period?: string;
  periodOptions?: PeriodOption[];
  onPeriodChange?: (option: PeriodOption) => void;
  defaultView?: ChartView;
  accent?: MetricAccent;
  data?: SeriesPoint[];
  series?: MetricSeries[];
  defaultIndex?: number;
  size?: CardSize;
  showStats?: boolean;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
  loading?: boolean;
  className?: string;
}
const DEFAULT_PERIODS: PeriodOption[] = [
  { label: "Últimos 7 dias", points: 7 },
  { label: "Últimos 14 dias", points: 14 },
  { label: "Últimos 30 dias" },
];
const SIZES = {
  sm: {
    minH: "min-h-[260px]",
    pad: "px-6 pt-5",
    footer: "px-6 py-3",
    title: "text-[15px]",
    headline: "text-[46px]",
  },
  md: {
    minH: "min-h-[380px]",
    pad: "px-8 pt-7",
    footer: "px-8 py-4",
    title: "text-[17px]",
    headline: "text-[72px]",
  },
  lg: {
    minH: "min-h-[460px]",
    pad: "px-10 pt-9",
    footer: "px-10 py-5",
    title: "text-[19px]",
    headline: "text-[88px]",
  },
} as const;

export default function ProgressMetricCard({
  title,
  total,
  delta,
  deltaLabel = "no último período",
  percent,
  trend,
  unit,
  period = "Últimos 7 dias",
  periodOptions,
  onPeriodChange,
  defaultView = "curve",
  accent,
  data,
  series,
  defaultIndex,
  size = "md",
  showStats = true,
  valueFormatter,
  dateFormatter,
  loading = false,
  className = "",
}: ProgressMetricCardProps) {
  const gridId = `grid-${useId().replace(/:/g, "")}`;
  const sz = SIZES[size];
  const shell = `relative flex ${sz.minH} w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_28px_-24px_rgba(0,0,0,.8)] ${className}`;
  const periods = periodOptions ?? DEFAULT_PERIODS;
  const [selectedLabel, setSelectedLabel] = useState(period);
  const [view, setView] = useState<ChartView>(defaultView);
  const baseSeries = useMemo<MetricSeries[]>(
    () => (series?.length ? series : [{ name: title, data: data ?? [], accent }]),
    [series, data, title, accent],
  );
  const selected = periods.find((item) => item.label === selectedLabel) ?? periods.at(-1);
  const visibleSeries = useMemo(
    () =>
      baseSeries.map((item) => ({
        ...item,
        data: selected?.points ? item.data.slice(-selected.points) : item.data,
      })),
    [baseSeries, selected],
  );
  const primary = visibleSeries[0];
  const values = useMemo(() => primary?.data.map((item) => item.value) ?? [], [primary]);
  const stats = useMemo(() => {
    const sum = values.reduce((a, b) => a + b, 0);
    const first = values[0] ?? 0;
    const last = values.at(-1) ?? 0;
    const prev = values.at(-2) ?? first;
    return {
      sum,
      net: last - first,
      pct: first ? ((last - first) / first) * 100 : 0,
      step: last - prev,
      peak: Math.max(...values, 0),
      low: values.length ? Math.min(...values) : 0,
      avg: values.length ? sum / values.length : 0,
    };
  }, [values]);
  const resolvedTrend =
    trend ?? (Math.abs(stats.pct) < 0.5 ? "flat" : stats.net >= 0 ? "up" : "down");
  const resolvedAccent =
    accent ?? (resolvedTrend === "up" ? "sky" : resolvedTrend === "down" ? "rose" : "neutral");
  const color = ACCENTS[resolvedAccent];
  const TrendIcon =
    resolvedTrend === "flat" ? ArrowRight : resolvedTrend === "down" ? ArrowDown : ArrowUp;
  const compact = valueFormatter ?? formatCompact;
  const full =
    valueFormatter ?? ((value: number) => value.toLocaleString("pt-BR") + (unit ? ` ${unit}` : ""));
  const date = dateFormatter ?? ((value: string) => value);
  const chartSeries: ChartSeries[] = visibleSeries.map((item, index) => ({
    name: item.name,
    data: item.data,
    color: item.accent ? ACCENTS[item.accent].stroke : SERIES_COLORS[index % SERIES_COLORS.length],
  }));
  if (loading)
    return (
      <div className={shell}>
        <div className={`flex flex-1 flex-col ${sz.pad}`}>
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-14 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-auto h-24 animate-pulse rounded bg-muted/50" />
        </div>
      </div>
    );
  if (values.length < 2)
    return (
      <div className={shell}>
        <div className={`flex flex-1 flex-col ${sz.pad}`}>
          <h3 className={`${sz.title} font-semibold`}>{title}</h3>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">Sem dados ainda</p>
            <p className="text-xs text-muted-foreground">
              As métricas aparecerão quando houver atividade.
            </p>
          </div>
        </div>
      </div>
    );
  return (
    <div className={shell}>
      <div className="absolute inset-y-0 right-0 z-0 w-[62%]">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to left, ${color.stroke}1f, transparent 75%)` }}
        />
        <div
          className="absolute inset-0 text-foreground/[.12]"
          style={{ maskImage: "linear-gradient(to right, transparent, black 55%)" }}
        >
          <svg className="h-full w-full" aria-hidden>
            <defs>
              <pattern id={gridId} width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${gridId})`} />
          </svg>
        </div>
        <MetricChart
          series={chartSeries}
          view={view}
          defaultIndex={defaultIndex}
          valueFormatter={full}
          dateFormatter={date}
        />
      </div>
      <div className={`pointer-events-none relative z-10 flex flex-1 flex-col ${sz.pad}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className={`${sz.title} font-semibold tracking-tight`}>{title}</h3>
            <ViewToggle value={view} onChange={setView} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 font-medium" style={{ color: color.text }}>
              <TrendIcon size={16} />
              {percent ?? `${Math.abs(stats.pct).toFixed(1)}%`}
            </span>
            <PeriodSelect
              value={selectedLabel}
              options={periods}
              onChange={(option) => {
                setSelectedLabel(option.label);
                onPeriodChange?.(option);
              }}
              accentText={color.text}
            />
          </div>
        </div>
        {chartSeries.length > 1 && (
          <div className="mt-2.5 flex gap-4">
            {chartSeries.map((item) => (
              <span
                key={item.name}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
            ))}
          </div>
        )}
        <div className={`mt-5 ${sz.headline} font-medium leading-none tracking-tight`}>
          {total ?? compact(stats.sum)}
        </div>
      </div>
      <div
        className={`relative z-10 flex items-center justify-between gap-4 border-t border-foreground/[.06] bg-card ${sz.footer} text-sm`}
      >
        <div>
          <span className="font-medium" style={{ color: color.text }}>
            {delta ?? `${stats.step >= 0 ? "+" : "−"}${compact(Math.abs(stats.step))}`}
          </span>{" "}
          <span className="text-muted-foreground">{deltaLabel}</span>
        </div>
        {showStats && (
          <div className="flex gap-2.5 text-xs text-muted-foreground">
            <span>
              <b className="text-foreground/80">{compact(stats.peak)}</b> pico
            </span>
            <span>·</span>
            <span>
              <b className="text-foreground/80">{compact(stats.low)}</b> mín.
            </span>
            <span>·</span>
            <span>
              <b className="text-foreground/80">{compact(Math.round(stats.avg))}</b> média
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
