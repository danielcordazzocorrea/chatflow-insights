import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Upload,
  Users,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CampaignTemplateDialog } from "@/components/campaigns/CampaignTemplateDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsDemo } from "@/contexts/AccessContext";

type Campaign = Tables<"campanhas">;
type Contact = Tables<"envio_em_massa">;
type Message = Pick<Tables<"webhook_messages">, "message_status">;
type TemplateRecord = Record<string, Json | undefined>;
type CampaignPercentages = {
  contacts: number;
  sent: number;
  interaction: number;
  delivered: number;
  read: number;
};

const statusLabels: Record<Campaign["status"], string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Em aprovação",
  pronta: "Pronta",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  erro: "Erro",
};

const statusClasses: Record<Campaign["status"], string> = {
  rascunho: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  aguardando_aprovacao: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  pronta: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  em_andamento: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  pausada: "bg-orange-400/10 text-orange-300 border-orange-400/20",
  concluida: "bg-green-400/10 text-green-300 border-green-400/20",
  cancelada: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  erro: "bg-red-400/10 text-red-300 border-red-400/20",
};

const asTemplates = (value: Json | null): TemplateRecord[] => {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is TemplateRecord =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );

const previewCampaigns: Campaign[] = [
  {
    id: 1,
    nome: "Boas-vindas Maio",
    descricao: "Recepção e ativação de novos clientes",
    tipo: 0,
    status: "em_andamento",
    created_at: "2026-08-18T13:20:00Z",
    created_by: null,
    templates_meta: [{ name: "boas_vindas_maio", meta_id: "preview-1", status: "APPROVED" }],
    meta_templates_status: {},
  },
  {
    id: 2,
    nome: "Promoção de inverno",
    descricao: "Oferta com acesso à página promocional",
    tipo: 1,
    status: "rascunho",
    created_at: "2026-08-17T16:10:00Z",
    created_by: null,
    templates_meta: null,
    meta_templates_status: {},
  },
  {
    id: 3,
    nome: "Reengajamento 90 dias",
    descricao: "Clientes sem interação recente",
    tipo: 0,
    status: "concluida",
    created_at: "2026-08-14T11:45:00Z",
    created_by: null,
    templates_meta: null,
    meta_templates_status: {},
  },
];

const previewContacts: Contact[] = Array.from({ length: 48 }, (_, index) => ({
  id: index + 1,
  campanha_id: 1,
  nome: `Contato ${index + 1}`,
  telefone: `55119999${String(index).padStart(4, "0")}`,
  bsuid: null,
  etapa: index < 12 ? 0 : index < 35 ? 1 : 2,
  etapa_manual_at: null,
  clicked_at: null,
}));

const previewMessages: Message[] = Array.from({ length: 36 }, (_, index) => ({
  message_status: index < 18 ? "read" : index < 29 ? "delivered" : index < 34 ? "sent" : "failed",
}));

const previewPercentages = new Map<number, CampaignPercentages>([
  [1, { contacts: 48, sent: 75, interaction: 27, delivered: 81, read: 50 }],
  [2, { contacts: 126, sent: 38, interaction: 12, delivered: 92, read: 64 }],
  [3, { contacts: 84, sent: 100, interaction: 61, delivered: 96, read: 78 }],
]);

const invoke = async <T,>(name: string, body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data;
};

function StatusPill({ status }: { status: Campaign["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-1 text-[10px] font-bold",
        statusClasses[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export default function Campaigns() {
  const navigate = useNavigate();
  const isDemo = useIsDemo();
  const searchParams = new URLSearchParams(window.location.search);
  const visualPreview = isDemo || (import.meta.env.DEV && searchParams.has("visual-preview"));
  const [campaigns, setCampaigns] = useState<Campaign[]>(visualPreview ? previewCampaigns : []);
  const [contacts, setContacts] = useState<Contact[]>(visualPreview ? previewContacts : []);
  const [messages, setMessages] = useState<Message[]>(visualPreview ? previewMessages : []);
  const [campaignPercentages, setCampaignPercentages] = useState(
    visualPreview ? previewPercentages : new Map<number, CampaignPercentages>(),
  );
  const [selectedId, setSelectedId] = useState<number | null>(visualPreview ? 1 : null);
  const [loading, setLoading] = useState(!visualPreview);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(
    visualPreview && searchParams.has("template-preview"),
  );
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("0");
  const [contactText, setContactText] = useState("");
  const [stage, setStage] = useState("0");
  const [templateId, setTemplateId] = useState("");

  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const templates = useMemo(() => asTemplates(selected?.templates_meta ?? null), [selected]);

  const loadCampaigns = useCallback(async () => {
    if (visualPreview) return;
    setLoading(true);
    const [campaignResult, contactResult, messageResult] = await Promise.all([
      supabase.from("campanhas").select("*").order("created_at", { ascending: false }),
      supabase.from("envio_em_massa").select("campanha_id,etapa"),
      supabase.from("webhook_messages").select("campanha_id,message_status"),
    ]);
    const { data, error } = campaignResult;
    if (error) {
      toast.error("Não foi possível carregar as campanhas", { description: error.message });
    } else {
      setCampaigns(data ?? []);
      setSelectedId((current) => current ?? data?.[0]?.id ?? null);

      const percentages = new Map<number, CampaignPercentages>();
      (data ?? []).forEach((campaign) => {
        const campaignContacts = (contactResult.data ?? []).filter(
          (contact) => contact.campanha_id === campaign.id,
        );
        const campaignMessages = (messageResult.data ?? []).filter(
          (message) => message.campanha_id === campaign.id,
        );
        const contactTotal = campaignContacts.length;
        const messageTotal = campaignMessages.length;
        const percentage = (value: number, total: number) =>
          total ? Math.round((value / total) * 100) : 0;
        percentages.set(campaign.id, {
          contacts: contactTotal,
          sent: percentage(
            campaignContacts.filter((contact) => Number(contact.etapa ?? 0) >= 1).length,
            contactTotal,
          ),
          interaction: percentage(
            campaignContacts.filter((contact) => Number(contact.etapa ?? 0) >= 2).length,
            contactTotal,
          ),
          delivered: percentage(
            campaignMessages.filter((message) =>
              ["delivered", "read"].includes(message.message_status ?? ""),
            ).length,
            messageTotal,
          ),
          read: percentage(
            campaignMessages.filter((message) => message.message_status === "read").length,
            messageTotal,
          ),
        });
      });
      setCampaignPercentages(percentages);
    }
    setLoading(false);
  }, [visualPreview]);

  const loadDetails = useCallback(
    async (campaignId: number | null) => {
      if (visualPreview) return;
      if (!campaignId) {
        setContacts([]);
        setMessages([]);
        return;
      }
      const [contactResult, messageResult] = await Promise.all([
        supabase.from("envio_em_massa").select("*").eq("campanha_id", campaignId).order("id"),
        supabase.from("webhook_messages").select("message_status").eq("campanha_id", campaignId),
      ]);
      const error = contactResult.error ?? messageResult.error;
      if (error)
        toast.error("Não foi possível carregar o relatório", { description: error.message });
      setContacts(contactResult.data ?? []);
      setMessages(messageResult.data ?? []);
    },
    [visualPreview],
  );

  useEffect(() => {
    document.title = "Campanhas — WhatsApp Automation";
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    void loadDetails(selectedId);
  }, [loadDetails, selectedId]);

  useEffect(() => {
    if (!templates.length) {
      setTemplateId("");
      return;
    }
    const latest = templates[templates.length - 1];
    setTemplateId(String(latest.meta_id ?? latest.name ?? ""));
  }, [templates]);

  const stageCounts = useMemo(() => {
    const result = new Map<number, number>();
    contacts.forEach((contact) => {
      const value = Number(contact.etapa ?? 0);
      result.set(value, (result.get(value) ?? 0) + 1);
    });
    return result;
  }, [contacts]);

  const interactionData = useMemo(() => {
    const stage0 = stageCounts.get(0) ?? 0;
    const stage1 = stageCounts.get(1) ?? 0;
    const stage2 = stageCounts.get(2) ?? 0;
    return selected?.tipo === 1
      ? [
          { name: "Não enviados", value: stage0, color: "#475569" },
          { name: "Enviados", value: stage1, color: "#20c873" },
          { name: "Clicaram", value: stage2, color: "#34d399" },
        ]
      : [
          { name: "Não enviados", value: stage0, color: "#475569" },
          { name: "Enviados", value: stage1, color: "#20c873" },
          { name: "Interagiram", value: stage2, color: "#34d399" },
        ];
  }, [selected?.tipo, stageCounts]);

  const messageData = useMemo(() => {
    const counts = new Map<string, number>();
    messages.forEach(({ message_status }) => {
      const key = message_status ?? "sem_status";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [
      { name: "Lidas", value: counts.get("read") ?? 0, color: "#34d399" },
      { name: "Entregues", value: counts.get("delivered") ?? 0, color: "#20c873" },
      {
        name: "Enviadas",
        value: (counts.get("sent") ?? 0) + (counts.get("accepted") ?? 0),
        color: "#86efac",
      },
      { name: "Falhas", value: counts.get("failed") ?? 0, color: "#fb7185" },
    ];
  }, [messages]);

  const summaries = [
    {
      label: "Campanhas",
      value: campaigns.length,
      icon: Send,
      color: "text-emerald-300 bg-emerald-400/10",
    },
    {
      label: "Rascunhos",
      value: campaigns.filter((item) => item.status === "rascunho").length,
      icon: FileText,
      color: "text-amber-300 bg-amber-400/10",
    },
    {
      label: "Em andamento",
      value: campaigns.filter((item) => item.status === "em_andamento").length,
      icon: Clock3,
      color: "text-emerald-300 bg-emerald-400/10",
    },
    {
      label: "Concluídas",
      value: campaigns.filter((item) => item.status === "concluida").length,
      icon: CheckCircle2,
      color: "text-green-300 bg-green-400/10",
    },
  ];

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (isDemo) return toast.info("Criação desabilitada no ambiente demonstrativo");
    setBusy("create");
    try {
      const data = await invoke<{ campaign: Campaign }>("create-campaign", {
        nome,
        descricao,
        tipo: Number(tipo),
      });
      toast.success("Campanha criada");
      setCreateOpen(false);
      setNome("");
      setDescricao("");
      await loadCampaigns();
      navigate(`/campanhas/${data.campaign.id}`);
    } catch (error) {
      toast.error("Erro ao criar campanha", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const parseContacts = () =>
    contactText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [nomeValue, identifier = ""] = line.split(/[;,\t]/).map((value) => value.trim());
        const phone = identifier || nomeValue;
        return identifier ? { nome: nomeValue, telefone: phone } : { telefone: phone };
      });

  const handleContacts = async (event: FormEvent) => {
    event.preventDefault();
    if (isDemo) return toast.info("Importação desabilitada no ambiente demonstrativo");
    if (!selected) return;
    const parsed = parseContacts();
    if (!parsed.length) return toast.error("Informe ao menos um contato");
    setBusy("contacts");
    try {
      await invoke("add-campaign-contacts", { campanha_id: selected.id, contatos: parsed });
      toast.success(`${parsed.length} contato(s) adicionado(s)`);
      setContactText("");
      setContactsOpen(false);
      await loadDetails(selected.id);
    } catch (error) {
      toast.error("Erro ao adicionar contatos", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleTrigger = async () => {
    if (!selected) return;
    if (isDemo) return toast.info("Disparo desabilitado no ambiente demonstrativo");
    setBusy("trigger");
    try {
      const data = await invoke<{ quantidade_contatos: number }>("trigger-campaign", {
        campanha_id: selected.id,
        etapa: Number(stage),
        ...(templateId ? { template_id: templateId } : {}),
      });
      toast.success("Etapa enviada ao n8n", {
        description: `${data.quantidade_contatos} contato(s) na fila.`,
      });
    } catch (error) {
      toast.error("Não foi possível acionar o n8n", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-content scrollbar-hidden h-[calc(100vh-4rem)] overflow-y-auto p-4 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.04em] lg:text-4xl">Campanhas</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Gerencie modelos, contatos e disparos por etapa.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void loadCampaigns()}
              aria-label="Atualizar campanhas"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={isDemo}>
              <Plus className="mr-2 h-4 w-4" />
              Nova campanha
            </Button>
          </div>
        </header>

        <nav className="mb-4 flex w-fit rounded-xl border bg-card/40 p-1 text-sm font-semibold">
          <span className="rounded-lg bg-emerald-400/15 px-4 py-2 text-emerald-300">Campanhas</span>
          <Link
            to="/campanhas/templates"
            className="rounded-lg px-4 py-2 text-muted-foreground transition hover:text-foreground"
          >
            Templates
          </Link>
        </nav>

        <section className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {summaries.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="control-card flex items-center gap-3 p-3.5">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", color)}>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold tabular-nums">{loading ? "—" : value}</p>
              </div>
            </Card>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Todas as campanhas</h2>
              <p className="text-xs text-muted-foreground">
                Selecione uma campanha para abrir o dashboard completo
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{campaigns.length} campanhas</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const metrics = campaignPercentages.get(campaign.id) ?? {
                contacts: 0,
                sent: 0,
                interaction: 0,
                delivered: 0,
                read: 0,
              };
              const interactionLabel = campaign.tipo === 1 ? "Cliques" : "Interações";

              return (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => navigate(`/campanhas/${campaign.id}`)}
                  className="control-card group min-w-0 rounded-2xl p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-[0_18px_40px_-28px_rgba(32,200,115,.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold">{campaign.nome}</h3>
                        <StatusPill status={campaign.status} />
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {campaign.tipo === 1 ? (
                          <Link2 className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-300" />
                        )}
                        {campaign.tipo === 1 ? "Campanha com link" : "Campanha de interação"}
                        <span>·</span>
                        <span>{metrics.contacts} contatos</span>
                      </p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-emerald-400/[0.06] text-emerald-300 transition group-hover:bg-emerald-400/15">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="my-4 grid grid-cols-2 gap-x-5 gap-y-3">
                    <CampaignPercentage label="Enviados" value={metrics.sent} />
                    <CampaignPercentage label="Entregues" value={metrics.delivered} />
                    <CampaignPercentage label={interactionLabel} value={metrics.interaction} />
                    <CampaignPercentage label="Leitura" value={metrics.read} />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground">
                    <span>{formatDate(campaign.created_at)}</span>
                    <span className="font-bold text-emerald-300">Abrir campanha</span>
                  </div>
                </button>
              );
            })}
          </div>

          {!loading && !campaigns.length && (
            <Card className="control-card flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              Crie sua primeira campanha para começar.
            </Card>
          )}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-border bg-popover">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Criar campanha</DialogTitle>
              <DialogDescription>
                Defina o objetivo antes de adicionar contatos e templates.
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-4">
              <div>
                <Label htmlFor="campaign-name">Nome</Label>
                <Input
                  id="campaign-name"
                  className="mt-2"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={160}
                  required
                />
              </div>
              <div>
                <Label htmlFor="campaign-description">Descrição</Label>
                <Textarea
                  id="campaign-description"
                  className="mt-2"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={2000}
                />
              </div>
              <div>
                <Label>Tipo de campanha</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Interação</SelectItem>
                    <SelectItem value="1">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy === "create"}>
                {busy === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
                campanha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contactsOpen} onOpenChange={setContactsOpen}>
        <DialogContent className="border-border bg-popover">
          <form onSubmit={handleContacts}>
            <DialogHeader>
              <DialogTitle>Importar contatos</DialogTitle>
              <DialogDescription>
                Uma linha por contato: nome;telefone. Também aceitamos apenas o telefone.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              className="my-5 min-h-56 font-mono text-xs"
              placeholder={"Ana;+5511999999999\nBruno;+5511888888888"}
              value={contactText}
              onChange={(e) => setContactText(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setContactsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy === "contacts"}>
                {busy === "contacts" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adicionar
                contatos
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CampaignTemplateDialog
        campaign={selected}
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onSaved={loadCampaigns}
      />
    </div>
  );
}

function CampaignPercentage({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{label}</span>
        <span className="text-lg font-extrabold tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/60">
        <span
          className="block h-full rounded-full bg-emerald-400 transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  total,
  data,
}: {
  title: string;
  total: number;
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <Card className="control-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Distribuição atual da campanha</p>
        </div>
        <Users className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="grid items-center gap-3 sm:grid-cols-[210px_1fr]">
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.14)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">{total}</span>
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
              <span className="font-semibold tabular-nums">
                {item.value}{" "}
                <span className="font-normal text-muted-foreground">
                  ({total ? Math.round((item.value / total) * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
