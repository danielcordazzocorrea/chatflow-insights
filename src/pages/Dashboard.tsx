import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Users, MessageSquare, CheckCircle2, TrendingUp } from "lucide-react";
import IaGlobalCard from "@/components/IaGlobalCard";
import ProgressMetricCard, { type MetricSeries } from "@/components/ui/progress-metric-card";
import { useIsDemo } from "@/contexts/AccessContext";
import { demoDateRows } from "@/lib/demo-data";

type DateRow = { created_at: string };
type Summary = { clientes: number; mensagens: number; respondidos: number };

const PAGE_SIZE = 1000;

async function fetchClienteDates(since: string) {
  const rows: DateRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("dados_cliente")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function fetchMessageDates(since: string) {
  const rows: DateRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("webhook_messages")
      .select("created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export default function Dashboard() {
  const isDemo = useIsDemo();
  const [clientes, setClientes] = useState<DateRow[]>([]);
  const [messages, setMessages] = useState<DateRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ clientes: 0, mensagens: 0, respondidos: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Dashboard — WhatsApp Automation";
    const load = async () => {
      setLoadError(null);
      if (isDemo) {
        setSummary({ clientes: 128, mensagens: 1847, respondidos: 93 });
        setClientes(demoDateRows(128));
        setMessages(demoDateRows(420));
        setLoading(false);
        return;
      }
      try {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - 29);
        windowStart.setHours(0, 0, 0, 0);

        const [clientesCount, mensagensCount, respondidosCount, clienteDates, messageDates] =
          await Promise.all([
            supabase.from("dados_cliente").select("id", { count: "exact", head: true }),
            supabase.from("webhook_messages").select("id", { count: "exact", head: true }),
            supabase
              .from("dados_cliente")
              .select("id", { count: "exact", head: true })
              .eq("responded", "true"),
            fetchClienteDates(windowStart.toISOString()),
            fetchMessageDates(windowStart.toISOString()),
          ]);

        const queryError = clientesCount.error ?? mensagensCount.error ?? respondidosCount.error;
        if (queryError) throw queryError;

        setSummary({
          clientes: clientesCount.count ?? 0,
          mensagens: mensagensCount.count ?? 0,
          respondidos: respondidosCount.count ?? 0,
        });
        setClientes(clienteDates);
        setMessages(messageDates);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível consultar o Supabase.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    };
    load();

    if (isDemo) return;
    const ch = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dados_cliente" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDemo]);

  const stats = useMemo(() => {
    const total = summary.clientes;
    const responded = summary.respondidos;
    const pending = total - responded;
    const respondedPct = total ? Math.round((responded / total) * 100) : 0;
    return { total, responded, pending, respondedPct, totalMsgs: summary.mensagens };
  }, [summary]);

  const pieData = [
    { name: "Respondidos", value: stats.responded },
    { name: "Pendentes", value: stats.pending },
  ];
  const pieColors = ["oklch(0.7 0.18 240)", "oklch(0.62 0.12 220)"];

  const timeData = useMemo(() => {
    const days: Record<string, { day: string; clientes: number; mensagens: number }> = {};
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
      days[key] = { day: label, clientes: 0, mensagens: 0 };
    }
    clientes.forEach((c) => {
      const k = c.created_at.slice(0, 10);
      if (days[k]) days[k].clientes++;
    });
    messages.forEach((m) => {
      const k = m.created_at.slice(0, 10);
      if (days[k]) days[k].mensagens++;
    });
    return Object.values(days);
  }, [clientes, messages]);

  const activitySeries = useMemo<MetricSeries[]>(
    () => [
      {
        name: "Mensagens",
        accent: "sky",
        data: timeData.map((item) => ({ value: item.mensagens, date: item.day })),
      },
      {
        name: "Clientes",
        data: timeData.map((item) => ({ value: item.clientes, date: item.day })),
      },
    ],
    [timeData],
  );

  const metrics = [
    { label: "Clientes", value: stats.total, icon: Users, accent: "oklch(0.7 0.18 240)" },
    {
      label: "Mensagens",
      value: stats.totalMsgs,
      icon: MessageSquare,
      accent: "oklch(0.7 0.18 240)",
    },
    {
      label: "Respondidos",
      value: stats.responded,
      icon: CheckCircle2,
      accent: "oklch(0.7 0.18 240)",
    },
    {
      label: "Taxa de Resposta",
      value: `${stats.respondedPct}%`,
      icon: TrendingUp,
      accent: "oklch(0.7 0.18 240)",
    },
  ];

  return (
    <div className="page-content h-[calc(100vh-4rem)] overflow-x-hidden overflow-y-auto scrollbar-thin p-5 sm:p-8 lg:p-9">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-[-0.04em]">
            Dashboard de Operações
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Métricas em tempo real do canal WhatsApp
          </p>
        </div>
        <div className="status-label">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success mr-2" />
          Sistema online
        </div>
      </header>

      <IaGlobalCard />

      {loadError && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <span>Não foi possível carregar as métricas do Supabase: {loadError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="font-semibold text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="metric-card p-5 lg:p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-semibold text-muted-foreground">{m.label}</span>
                <span
                  className="metric-icon"
                  style={{ color: m.accent, background: `${m.accent}18` }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="text-3xl font-bold tracking-[-0.04em] tabular-nums relative">
                {loading ? "—" : m.value}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <ProgressMetricCard
          title="Clientes e mensagens"
          total={stats.totalMsgs}
          unit="mensagens"
          series={activitySeries}
          accent="sky"
          size="md"
          loading={loading}
          deltaLabel="desde o dia anterior"
          periodOptions={[
            { label: "Últimos 7 dias", points: 7 },
            { label: "Últimos 14 dias", points: 14 },
            { label: "Últimos 30 dias", points: 30 },
          ]}
          className="lg:col-span-3"
        />

        <Card className="control-card p-6">
          <h3 className="font-semibold mb-1">Status de respostas</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição dos clientes</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                stroke="none"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={pieColors[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.045 250)",
                  color: "white",
                  border: "1px solid oklch(0.4 0.08 245 / .5)",
                  borderRadius: 10,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {pieData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: pieColors[i] }} />
                  {p.name}
                </span>
                <span className="font-medium tabular-nums">{p.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
