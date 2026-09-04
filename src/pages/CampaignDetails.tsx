import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo } from "@/contexts/AccessContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignTemplateDialog } from "@/components/campaigns/CampaignTemplateDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Campaign = Tables<"campanhas">;
type Contact = Tables<"envio_em_massa">;
type Message = Pick<Tables<"webhook_messages">, "id" | "message_status">;
type LibraryTemplate = Tables<"templates_meta">;

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
  rascunho: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  aguardando_aprovacao: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  pronta: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  em_andamento: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  pausada: "border-orange-400/20 bg-orange-400/10 text-orange-300",
  concluida: "border-green-400/20 bg-green-400/10 text-green-300",
  cancelada: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  erro: "border-red-400/20 bg-red-400/10 text-red-300",
};

const previewCampaign: Campaign = {
  id: 1,
  nome: "Boas-vindas Maio",
  descricao: "Recepção e ativação de novos clientes",
  tipo: 0,
  status: "em_andamento",
  created_at: "2026-08-18T13:20:00Z",
  created_by: null,
  templates_meta: [{ name: "boas_vindas_maio", meta_id: "preview-1", status: "APPROVED" }],
  meta_templates_status: {},
};

const previewContacts: Contact[] = Array.from({ length: 48 }, (_, index) => ({
  id: index + 1,
  campanha_id: 1,
  nome: ["Marina Costa", "Lucas Almeida", "Fernanda Lima", "Rafael Souza"][index % 4],
  telefone: `55119${String(80000000 + index).padStart(8, "0")}`,
  bsuid: null,
  etapa: index < 12 ? 0 : index < 35 ? 1 : 2,
  etapa_manual_at: null,
  clicked_at: index >= 35 ? "2026-08-20T14:00:00Z" : null,
}));

const previewMessages: Message[] = Array.from({ length: 36 }, (_, index) => ({
  id: `preview-${index}`,
  message_status: index < 18 ? "read" : index < 29 ? "delivered" : index < 34 ? "sent" : "failed",
}));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );

const formatPhone = (value: string | null) => {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value;
};

function stageLabel(stage: number, linkCampaign: boolean) {
  if (stage === 0) return "Não enviado";
  if (stage === 1) return "Enviado";
  if (stage === 2) return linkCampaign ? "Clicou" : "Interagiu";
  return `Etapa ${stage}`;
}

export default function CampaignDetails() {
  const { campaignId } = useParams();
  const isDemo = useIsDemo();
  const visualPreview =
    isDemo ||
    (import.meta.env.DEV && new URLSearchParams(window.location.search).has("visual-preview"));
  const numericId = Number(campaignId);
  const [campaign, setCampaign] = useState<Campaign | null>(visualPreview ? previewCampaign : null);
  const [contacts, setContacts] = useState<Contact[]>(visualPreview ? previewContacts : []);
  const [messages, setMessages] = useState<Message[]>(visualPreview ? previewMessages : []);
  const [loading, setLoading] = useState(!visualPreview);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [libraryTemplates, setLibraryTemplates] = useState<LibraryTemplate[]>([]);
  const [linkedTemplateIds, setLinkedTemplateIds] = useState<number[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendStage, setSendStage] = useState("0");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (visualPreview) return;
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [campaignResult, contactsResult, messagesResult, libraryResult, linksResult] =
      await Promise.all([
        supabase.from("campanhas").select("*").eq("id", numericId).maybeSingle(),
        supabase.from("envio_em_massa").select("*").eq("campanha_id", numericId).order("id"),
        supabase.from("webhook_messages").select("id,message_status").eq("campanha_id", numericId),
        supabase.from("templates_meta").select("*").order("created_at", { ascending: false }),
        supabase.from("campanha_templates").select("template_id").eq("campanha_id", numericId),
      ]);
    const error = campaignResult.error ?? contactsResult.error ?? messagesResult.error;
    if (error) toast.error("Não foi possível carregar a campanha", { description: error.message });
    setCampaign(campaignResult.data);
    setContacts(contactsResult.data ?? []);
    setMessages(messagesResult.data ?? []);
    setLibraryTemplates(libraryResult.data ?? []);
    setLinkedTemplateIds((linksResult.data ?? []).map((link) => link.template_id));
    setNotFound(!campaignResult.data);
    setLoading(false);
  }, [numericId, visualPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = campaign ? `${campaign.nome} — Campanhas` : "Campanha — WhatsApp Automation";
  }, [campaign]);

  const stageCounts = useMemo(() => {
    const counts = new Map<number, number>();
    contacts.forEach((contact) => {
      const stage = Number(contact.etapa ?? 0);
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    });
    return counts;
  }, [contacts]);

  const messageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    messages.forEach((message) => {
      const status = message.message_status ?? "sem_status";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });
    return counts;
  }, [messages]);

  const advanced = contacts.filter((contact) => Number(contact.etapa ?? 0) >= 2).length;
  const conversion = contacts.length ? Math.round((advanced / contacts.length) * 100) : 0;
  const linkCampaign = campaign?.tipo === 1;
  const stageData = Array.from(new Set([0, 1, 2, ...stageCounts.keys()]))
    .sort((a, b) => a - b)
    .map((stage, index) => ({
      name: stageLabel(stage, linkCampaign),
      value: stageCounts.get(stage) ?? 0,
      color: ["#475569", "#20c873", "#34d399", "#86efac", "#fbbf24"][index % 5],
    }));
  const messageData = [
    { name: "Lidas", value: messageCounts.get("read") ?? 0, color: "#34d399" },
    { name: "Entregues", value: messageCounts.get("delivered") ?? 0, color: "#20c873" },
    {
      name: "Enviadas",
      value: (messageCounts.get("sent") ?? 0) + (messageCounts.get("accepted") ?? 0),
      color: "#86efac",
    },
    { name: "Falhas", value: messageCounts.get("failed") ?? 0, color: "#fb7185" },
  ];

  const visibleContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return contacts;
    return contacts.filter((contact) =>
      `${contact.nome ?? ""} ${contact.telefone ?? ""} ${stageLabel(Number(contact.etapa ?? 0), linkCampaign)}`
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [contacts, linkCampaign, search]);

  const reusableTemplates = libraryTemplates.filter(
    (template) => !linkedTemplateIds.includes(template.id),
  );
  const legacyTemplates = useMemo(() => {
    const value = campaign?.templates_meta;
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return items.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item)),
    );
  }, [campaign?.templates_meta]);
  const availableTemplates = [
    ...libraryTemplates
      .filter((template) => linkedTemplateIds.includes(template.id))
      .map((template) => ({
        id: String(template.id),
        name: template.name,
        status: template.status,
      })),
    ...legacyTemplates.map((template) => ({
      id: String(template.meta_id ?? template.name),
      name: String(template.name ?? "Template"),
      status: String(template.status ?? "PENDING"),
    })),
  ].filter(
    (template, index, items) => items.findIndex((item) => item.id === template.id) === index,
  );

  const reuseTemplate = async () => {
    if (!campaign || !selectedTemplateId) return;
    const { error } = await supabase.from("campanha_templates").insert({
      campanha_id: campaign.id,
      template_id: Number(selectedTemplateId),
    });
    if (error) {
      toast.error("Não foi possível vincular o template", { description: error.message });
      return;
    }
    toast.success("Template disponível nesta campanha");
    setReuseOpen(false);
    setSelectedTemplateId("");
    await load();
  };

  const sendCampaign = async () => {
    if (!campaign || !sendTemplateId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke<{ quantidade_contatos: number }>(
      "trigger-campaign",
      {
        body: {
          campanha_id: campaign.id,
          etapa: Number(sendStage),
          template_id: sendTemplateId,
        },
      },
    );
    setSending(false);
    if (error) {
      let description = error.message;
      if ("context" in error && error.context instanceof Response) {
        const body = await error.context.json().catch(() => null);
        if (body && typeof body === "object") {
          const responseError = body as { error?: string; detail?: unknown };
          description = responseError.error ?? description;
          if (responseError.detail) {
            const detail =
              typeof responseError.detail === "string"
                ? responseError.detail
                : JSON.stringify(responseError.detail);
            description = `${description}: ${detail}`;
          }
        }
      }
      toast.error("Não foi possível iniciar o envio", { description });
      return;
    }
    toast.success("Envio em massa iniciado", {
      description: `${data?.quantidade_contatos ?? 0} contato(s) enviados para a fila.`,
    });
    setSendOpen(false);
  };

  if (notFound) {
    return (
      <div className="page-content flex h-[calc(100vh-4rem)] items-center justify-center p-6">
        <Card className="control-card max-w-md p-8 text-center">
          <h1 className="text-xl font-bold">Campanha não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confira o endereço ou volte para a lista de campanhas.
          </p>
          <Button asChild className="mt-5">
            <Link to="/campanhas">Voltar para campanhas</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const metrics = [
    { label: "Contatos", value: contacts.length, icon: Users },
    { label: "Mensagens", value: messages.length, icon: MessageSquare },
    { label: linkCampaign ? "Cliques" : "Interações", value: advanced, icon: CheckCircle2 },
    { label: "Conversão", value: `${conversion}%`, icon: TrendingUp },
  ];

  return (
    <div className="page-content h-[calc(100vh-4rem)] w-screen max-w-full overflow-x-hidden overflow-y-auto p-4 scrollbar-thin sm:p-6 lg:p-8">
      <div className="mx-auto w-full min-w-0 max-w-[1600px]">
        <Link
          to="/campanhas"
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para campanhas
        </Link>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-bold tracking-[-0.04em] lg:text-4xl">
                {loading ? "Carregando campanha..." : campaign?.nome}
              </h1>
              {campaign && (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px]",
                    statusClasses[campaign.status],
                  )}
                >
                  {statusLabels[campaign.status]}
                </Badge>
              )}
            </div>
            {campaign && (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {linkCampaign ? (
                    <Link2 className="h-3.5 w-3.5" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5" />
                  )}
                  {linkCampaign ? "Campanha com link" : "Campanha de interação"}
                </span>
                <span className="basis-full sm:basis-auto">
                  Criada em {formatDate(campaign.created_at)}
                </span>
              </div>
            )}
            {campaign?.descricao && (
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{campaign.descricao}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSendOpen(true)} disabled={isDemo}>
              <MessageSquare className="mr-2 h-4 w-4" /> Enviar em massa
            </Button>
            <Button variant="outline" onClick={() => setReuseOpen(true)} disabled={isDemo}>
              <FileText className="mr-2 h-4 w-4" /> Usar template
            </Button>
            <Button onClick={() => setTemplateOpen(true)} disabled={isDemo}>
              <Plus className="mr-2 h-4 w-4" /> Criar template
            </Button>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Atualizar campanha"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="metric-card min-w-0 p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <span className="metric-icon bg-emerald-400/10 text-emerald-300">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="text-3xl font-bold tracking-[-0.04em] tabular-nums">
                {loading ? "—" : value}
              </p>
            </Card>
          ))}
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-2">
          <DistributionCard
            title="Etapas dos contatos"
            subtitle="Avanço atual da campanha"
            total={contacts.length}
            data={stageData}
          />
          <DistributionCard
            title="Status das mensagens"
            subtitle="Situação dos envios vinculados"
            total={messages.length}
            data={messageData}
          />
        </section>

        <Card className="control-card overflow-hidden">
          <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Contatos da campanha</h2>
              <p className="text-xs text-muted-foreground">
                {visibleContacts.length} de {contacts.length} contatos
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome, telefone ou etapa"
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Etapa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContacts.map((contact) => {
                  const stage = Number(contact.etapa ?? 0);
                  return (
                    <TableRow key={contact.id}>
                      <TableCell className="font-semibold">{contact.nome || "Sem nome"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatPhone(contact.telefone)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-[10px]",
                            stage >= 2
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                              : stage === 1
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                : "border-slate-400/20 bg-slate-400/10 text-slate-300",
                          )}
                        >
                          {stageLabel(stage, linkCampaign)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && !visibleContacts.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                      Nenhum contato encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={reuseOpen} onOpenChange={setReuseOpen}>
        <DialogContent className="border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Usar template existente</DialogTitle>
            <DialogDescription>
              Vincule à campanha um template já disponível na sua biblioteca.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="my-4">
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {reusableTemplates.map((template) => (
                <SelectItem key={template.id} value={String(template.id)}>
                  {template.name} · {template.language} · {template.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!reusableTemplates.length && (
            <p className="text-sm text-muted-foreground">
              Todos os templates da biblioteca já estão vinculados.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReuseOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void reuseTemplate()} disabled={!selectedTemplateId}>
              Usar nesta campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Enviar template em massa</DialogTitle>
            <DialogDescription>
              Escolha o template e a etapa dos contatos que receberão esta mensagem.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 grid gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold">Template</p>
              <Select value={sendTemplateId} onValueChange={setSendTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} · {template.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold">Etapa dos contatos</p>
              <Select value={sendStage} onValueChange={setSendStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([0, 1, 2, ...stageCounts.keys()]))
                    .sort()
                    .map((stage) => (
                      <SelectItem key={stage} value={String(stage)}>
                        {stageLabel(stage, linkCampaign)} · {stageCounts.get(stage) ?? 0} contatos
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void sendCampaign()}
              disabled={sending || !sendTemplateId || !(stageCounts.get(Number(sendStage)) ?? 0)}
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar para{" "}
              {stageCounts.get(Number(sendStage)) ?? 0} contatos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignTemplateDialog
        campaign={campaign}
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        onSaved={load}
      />
    </div>
  );
}

function DistributionCard({
  title,
  subtitle,
  total,
  data,
}: {
  title: string;
  subtitle: string;
  total: number;
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <Card className="control-card p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
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
              <span className="font-bold tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
