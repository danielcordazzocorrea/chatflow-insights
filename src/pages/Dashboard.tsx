import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Users, MessageSquare, CheckCircle2, Activity, TrendingUp } from "lucide-react";

type Cliente = { id: string; nome: string | null; telefone: string | null; responded: string | null; created_at: string };
type Msg = { id: string; message_text: string | null; who_sent: string | null; telefone: string | null; created_at: string };

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard — WhatsApp Automation";
    const load = async () => {
      const [c, m] = await Promise.all([
        supabase.from("dados_cliente").select("*").order("created_at", { ascending: false }),
        supabase.from("webhook_messages").select("*").order("created_at", { ascending: false }).limit(1000),
      ]);
      setClientes((c.data as Cliente[]) ?? []);
      setMessages((m.data as Msg[]) ?? []);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dados_cliente" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const stats = useMemo(() => {
    const total = clientes.length;
    const responded = clientes.filter((c) => c.responded === "true").length;
    const pending = total - responded;
    const respondedPct = total ? Math.round((responded / total) * 100) : 0;
    const totalMsgs = messages.length;
    const clientMsgs = messages.filter((m) => m.who_sent === "client").length;
    const botMsgs = totalMsgs - clientMsgs;
    return { total, responded, pending, respondedPct, totalMsgs, clientMsgs, botMsgs };
  }, [clientes, messages]);

  const pieData = [
    { name: "Respondidos", value: stats.responded },
    { name: "Pendentes", value: stats.pending },
  ];
  const pieColors = ["oklch(0.72 0.18 155)", "oklch(0.78 0.2 50)"];

  const timeData = useMemo(() => {
    const days: Record<string, { day: string; clientes: number; mensagens: number }> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
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

  const metrics = [
    { label: "Clientes", value: stats.total, icon: Users, accent: "oklch(0.7 0.18 240)" },
    { label: "Mensagens", value: stats.totalMsgs, icon: MessageSquare, accent: "oklch(0.78 0.2 200)" },
    { label: "Respondidos", value: stats.responded, icon: CheckCircle2, accent: "oklch(0.72 0.18 155)" },
    { label: "Taxa de Resposta", value: `${stats.respondedPct}%`, icon: TrendingUp, accent: "oklch(0.65 0.22 280)" },
  ];

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin p-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em] mb-2">
          <Activity className="h-3 w-3 text-primary animate-pulse" /> Live data
        </div>
        <h1 className="text-3xl font-bold glow-text">Dashboard de Operações</h1>
        <p className="text-muted-foreground text-sm mt-1">Métricas em tempo real do canal WhatsApp</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="glass-panel p-5 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full blur-3xl opacity-30" style={{ background: m.accent }} />
              <div className="flex items-center justify-between mb-3 relative">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</span>
                <Icon className="h-4 w-4" style={{ color: m.accent }} />
              </div>
              <div className="text-3xl font-bold tracking-tight relative">{loading ? "—" : m.value}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-panel p-6 lg:col-span-2">
          <h3 className="font-semibold mb-1">Atividade (últimos 7 dias)</h3>
          <p className="text-xs text-muted-foreground mb-4">Novos clientes e mensagens trafegadas</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.08 245 / 0.2)" />
              <XAxis dataKey="day" stroke="oklch(0.7 0.04 240)" fontSize={11} />
              <YAxis stroke="oklch(0.7 0.04 240)" fontSize={11} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.045 250)", border: "1px solid oklch(0.4 0.08 245 / 0.4)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="clientes" stroke="oklch(0.7 0.18 240)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="mensagens" stroke="oklch(0.78 0.2 200)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass-panel p-6">
          <h3 className="font-semibold mb-1">Status de Resposta</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição dos clientes</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4} stroke="none">
                {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "oklch(0.22 0.045 250)", border: "1px solid oklch(0.4 0.08 245 / 0.4)", borderRadius: 8 }} />
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
