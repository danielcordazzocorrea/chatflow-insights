import { BarChart3, LineChart, ChevronDown } from "lucide-react";

export type PeriodOption = { label: string; points?: number };
export type ChartView = "curve" | "bar";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ChartView;
  onChange: (view: ChartView) => void;
}) {
  return (
    <div className="pointer-events-auto flex rounded-lg border border-border bg-background/70 p-0.5">
      <button
        type="button"
        aria-label="Visualização em linha"
        onClick={() => onChange("curve")}
        className={`rounded-md p-1.5 transition-colors ${value === "curve" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        <LineChart className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Visualização em barras"
        onClick={() => onChange("bar")}
        className={`rounded-md p-1.5 transition-colors ${value === "bar" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function PeriodSelect({
  value,
  options,
  onChange,
  accentText,
}: {
  value: string;
  options: PeriodOption[];
  onChange: (option: PeriodOption) => void;
  accentText?: string;
}) {
  return (
    <label className="pointer-events-auto relative flex items-center">
      <select
        value={value}
        onChange={(event) => {
          const option = options.find((item) => item.label === event.target.value);
          if (option) onChange(option);
        }}
        className="appearance-none rounded-lg border border-border bg-background/75 py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition-colors hover:border-primary/50 focus:border-primary"
        style={{ color: accentText }}
      >
        {options.map((option) => (
          <option key={option.label} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
    </label>
  );
}
