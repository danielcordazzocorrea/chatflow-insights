import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Columns3,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo } from "@/contexts/AccessContext";
import { demoClientes } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
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

type Pipeline = Tables<"lead_pipelines">;
type Stage = Tables<"lead_pipeline_stages">;
type Assignment = Tables<"lead_pipeline_assignments">;
type Client = Pick<Tables<"dados_cliente">, "id" | "bsuid" | "nome" | "telefone" | "responded">;
type CampaignContact = Pick<
  Tables<"envio_em_massa">,
  "id" | "bsuid" | "nome" | "telefone" | "etapa"
>;
type Lead = {
  key: string;
  name: string;
  phone: string | null;
  replied: boolean;
  campaignStage: number | null;
};
type Column = { id: string; name: string };

const PAGE_SIZE = 1000;
const columnCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

function leadKey(phone: string | null, bsuid: string | null, fallback: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length >= 10) return `p:${[10, 11].includes(digits.length) ? `55${digits}` : digits}`;
  return bsuid ? `b:${bsuid}` : fallback;
}

function collectLeads(clients: Client[], contacts: CampaignContact[]): Lead[] {
  const leads = new Map<string, Lead>();
  for (const client of clients) {
    const key = leadKey(client.telefone, client.bsuid, `c:${client.id}`);
    leads.set(key, {
      key,
      name: client.nome?.trim() || "Sem nome",
      phone: client.telefone,
      replied: client.responded === "true",
      campaignStage: null,
    });
  }
  for (const contact of contacts) {
    const key = leadKey(contact.telefone, contact.bsuid, `e:${contact.id}`);
    const current = leads.get(key);
    leads.set(key, {
      key,
      name:
        current?.name && current.name !== "Sem nome"
          ? current.name
          : contact.nome?.trim() || "Sem nome",
      phone: current?.phone || contact.telefone,
      replied: current?.replied ?? false,
      campaignStage: Math.max(current?.campaignStage ?? 0, Number(contact.etapa ?? 0)),
    });
  }
  return [...leads.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function loadClients(): Promise<Client[]> {
  const rows: Client[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("dados_cliente")
      .select("id,bsuid,nome,telefone,responded")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function loadCampaignContacts(): Promise<CampaignContact[]> {
  const rows: CampaignContact[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("envio_em_massa")
      .select("id,bsuid,nome,telefone,etapa")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

const demoPipeline: Pipeline = {
  id: "demo",
  owner_id: "demo",
  name: "Atendimento comercial",
  created_at: "",
  initial_stage_id: "new",
};
const demoStages: Stage[] = [
  { id: "new", pipeline_id: "demo", name: "Novo lead", position: 0, created_at: "" },
  { id: "reply", pipeline_id: "demo", name: "Respondido", position: 1, created_at: "" },
];
const demoAssignments: Assignment[] = demoClientes.map((client, index) => ({
  pipeline_id: "demo",
  lead_key: leadKey(client.telefone, client.bsuid, `c:${client.id}`),
  stage_id: index === 0 ? "new" : "reply",
  updated_at: "",
}));

function LeadCard({
  lead,
  stageId,
  columns,
  disabled,
  onMove,
}: {
  lead: Lead;
  stageId: string;
  columns: Column[];
  disabled: boolean;
  onMove: (lead: Lead, stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: lead.key,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className="rounded-lg border bg-card p-3 shadow-sm"
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <div className="flex items-start gap-2">
        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">{lead.phone ?? "Sem telefone"}</p>
        </div>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="-mr-1 -mt-1 cursor-grab rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing disabled:opacity-40"
          style={{ touchAction: "none" }}
          aria-label={`Arrastar ${lead.name} para outra etapa`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {lead.replied && (
          <Badge variant="outline" className="text-[10px]">
            Respondeu
          </Badge>
        )}
        {lead.campaignStage !== null && (
          <Badge variant="outline" className="text-[10px]">
            {lead.campaignStage >= 2
              ? "Interagiu na campanha"
              : lead.campaignStage === 1
                ? "Mensagem enviada"
                : "Aguardando campanha"}
          </Badge>
        )}
      </div>
      <Select value={stageId} onValueChange={(value) => onMove(lead, value)} disabled={disabled}>
        <SelectTrigger className="mt-3 h-8 text-xs" aria-label={`Etapa de ${lead.name}`}>
          <SelectValue placeholder="Mover para" />
        </SelectTrigger>
        <SelectContent>
          {columns.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PipelineColumn({
  column,
  leads,
  columns,
  assignmentByKey,
  initialStageId,
  isInitial,
  disabled,
  onMove,
  onEdit,
  onDelete,
  canDelete,
}: {
  column: Column;
  leads: Lead[];
  columns: Column[];
  assignmentByKey: Map<string, string>;
  initialStageId: string;
  isInitial: boolean;
  disabled: boolean;
  onMove: (lead: Lead, stageId: string) => void;
  onEdit: (stageId: string) => void;
  onDelete: (stageId: string) => void;
  canDelete: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-52 w-72 shrink-0 rounded-xl border p-3 transition-colors ${isOver ? "border-primary bg-primary/10" : "border-border/70 bg-background/40"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-bold" title={column.name}>
          {column.name}
        </h3>
        <div className="flex items-center gap-1">
          {isInitial && (
            <Badge variant="outline" className="text-[10px]">
              Inicial
            </Badge>
          )}
          <Badge variant="secondary" className="tabular-nums">
            {leads.length}
          </Badge>
          <button
            type="button"
            onClick={() => onEdit(column.id)}
            disabled={disabled}
            aria-label={`Renomear etapa ${column.name}`}
            title="Renomear etapa"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(column.id)}
            disabled={disabled || !canDelete}
            aria-label={`Apagar etapa ${column.name}`}
            title={canDelete ? "Apagar etapa" : "Mantenha ao menos uma etapa"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {leads.map((lead) => (
          <LeadCard
            key={lead.key}
            lead={lead}
            stageId={assignmentByKey.get(lead.key) ?? initialStageId}
            columns={columns}
            disabled={disabled}
            onMove={onMove}
          />
        ))}
        {!leads.length && (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Solte um lead aqui.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LeadPipeline() {
  const isDemo = useIsDemo();
  const [pipeline, setPipeline] = useState<Pipeline | null>(isDemo ? demoPipeline : null);
  const [stages, setStages] = useState<Stage[]>(isDemo ? demoStages : []);
  const [assignments, setAssignments] = useState<Assignment[]>(isDemo ? demoAssignments : []);
  const [leads, setLeads] = useState<Lead[]>(isDemo ? collectLeads(demoClientes, []) : []);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [deletingStage, setDeletingStage] = useState<Stage | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [initialStageName, setInitialStageName] = useState("");
  const [stageName, setStageName] = useState("");
  const [editStageName, setEditStageName] = useState("");
  const [replacementStageId, setReplacementStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [activeLeadKey, setActiveLeadKey] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const load = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    setError(null);
    try {
      const [pipelineResult, clients, contacts] = await Promise.all([
        supabase.from("lead_pipelines").select("*").maybeSingle(),
        loadClients(),
        loadCampaignContacts(),
      ]);
      if (pipelineResult.error) throw pipelineResult.error;
      const current = pipelineResult.data;
      setPipeline(current);
      setLeads(collectLeads(clients, contacts));
      if (current) {
        const [stageResult, assignmentResult] = await Promise.all([
          supabase
            .from("lead_pipeline_stages")
            .select("*")
            .eq("pipeline_id", current.id)
            .order("position")
            .order("created_at"),
          supabase.from("lead_pipeline_assignments").select("*").eq("pipeline_id", current.id),
        ]);
        if (stageResult.error || assignmentResult.error)
          throw stageResult.error ?? assignmentResult.error;
        setStages(stageResult.data ?? []);
        setAssignments(assignmentResult.data ?? []);
      } else {
        setStages([]);
        setAssignments([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o pipeline.");
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignmentByKey = useMemo(
    () => new Map(assignments.map((item) => [item.lead_key, item.stage_id])),
    [assignments],
  );
  const filteredLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return query
      ? leads.filter((lead) =>
          `${lead.name} ${lead.phone ?? ""}`.toLocaleLowerCase("pt-BR").includes(query),
        )
      : leads;
  }, [leads, search]);

  const createPipeline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = pipelineName.trim();
    const initialName = initialStageName.trim();
    if (!name || !initialName || isDemo) return;
    setSaving(true);
    try {
      const { error: createError } = await supabase.rpc("create_lead_pipeline_with_stage", {
        p_name: name,
        p_initial_stage_name: initialName,
      });
      if (createError) throw createError;
      setCreateOpen(false);
      setPipelineName("");
      setInitialStageName("");
      await load();
      toast.success("Pipeline criado");
    } catch (cause) {
      toast.error("Não foi possível criar o pipeline", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const createStage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = stageName.trim();
    if (!pipeline || !name || isDemo) return;
    if (
      stages.some(
        (stage) => stage.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      toast.error("Já existe uma etapa com esse nome");
      return;
    }
    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from("lead_pipeline_stages")
        .insert({
          pipeline_id: pipeline.id,
          name,
          position: stages.length ? Math.max(...stages.map((stage) => stage.position)) + 1 : 0,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      setStages((current) => [...current, data]);
      setStageName("");
      setStageOpen(false);
      toast.success("Etapa criada");
    } catch (cause) {
      toast.error("Não foi possível criar a etapa", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const openStageEditor = (stageId: string) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    setEditingStage(stage);
    setEditStageName(stage.name);
  };

  const renameStage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = editStageName.trim();
    if (!pipeline || !editingStage || !name || isDemo) return;
    if (name === editingStage.name) {
      setEditingStage(null);
      return;
    }
    if (
      stages.some(
        (stage) =>
          stage.id !== editingStage.id &&
          stage.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      toast.error("Já existe uma etapa com esse nome");
      return;
    }
    setSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from("lead_pipeline_stages")
        .update({ name })
        .eq("id", editingStage.id)
        .eq("pipeline_id", pipeline.id)
        .select()
        .single();
      if (updateError) throw updateError;
      setStages((current) => current.map((stage) => (stage.id === data.id ? data : stage)));
      setEditingStage(null);
      toast.success("Etapa renomeada");
    } catch (cause) {
      toast.error("Não foi possível renomear a etapa", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteStage = (stageId: string) => {
    const stage = stages.find((item) => item.id === stageId);
    const replacement =
      stages.find((item) => item.id !== stageId && item.id === pipeline?.initial_stage_id) ??
      stages.find((item) => item.id !== stageId);
    if (!stage || !replacement) return;
    setDeletingStage(stage);
    setReplacementStageId(replacement.id);
  };

  const deleteStage = async () => {
    if (!deletingStage || !replacementStageId || isDemo || saving) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.rpc("delete_lead_pipeline_stage", {
        p_stage_id: deletingStage.id,
        p_replacement_stage_id: replacementStageId,
      });
      if (deleteError) throw deleteError;
      setDeletingStage(null);
      await load();
      toast.success("Etapa apagada e leads movidos");
    } catch (cause) {
      toast.error("Não foi possível apagar a etapa", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const moveLead = async (lead: Lead, stageId: string) => {
    if (!pipeline || isDemo || !stages.some((stage) => stage.id === stageId)) return;
    setMovingKey(lead.key);
    try {
      const { data, error: upsertError } = await supabase
        .from("lead_pipeline_assignments")
        .upsert(
          {
            pipeline_id: pipeline.id,
            lead_key: lead.key,
            stage_id: stageId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "pipeline_id,lead_key" },
        )
        .select()
        .single();
      if (upsertError) throw upsertError;
      setAssignments((current) => [...current.filter((item) => item.lead_key !== lead.key), data]);
      toast.success(`${lead.name} movido`);
    } catch (cause) {
      toast.error("Não foi possível mover o lead", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setMovingKey(null);
    }
  };

  const columns = stages;
  const initialStageId = pipeline?.initial_stage_id ?? stages[0]?.id ?? "";
  const affectedLeads = deletingStage
    ? leads.filter((lead) => (assignmentByKey.get(lead.key) ?? initialStageId) === deletingStage.id)
        .length
    : 0;
  const activeLead = leads.find((lead) => lead.key === activeLeadKey);
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLeadKey(null);
    const lead = leads.find((item) => item.key === event.active.id);
    const stageId = String(event.over?.id ?? "");
    if (!lead || !columns.some((column) => column.id === stageId)) return;
    if ((assignmentByKey.get(lead.key) ?? initialStageId) !== stageId) void moveLead(lead, stageId);
  };

  return (
    <section className="mt-6" aria-label="Pipeline de atendimento">
      <Card className="control-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Columns3 className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Atendimento</span>
            </div>
            <h2 className="text-xl font-bold">{pipeline?.name ?? "Pipeline de leads"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organize o atendimento manualmente. As etapas automáticas das campanhas continuam
              visíveis nos leads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pipeline && (
              <Button variant="outline" onClick={() => setStageOpen(true)} disabled={isDemo}>
                <Plus className="mr-2 h-4 w-4" /> Criar etapa
              </Button>
            )}
            {!pipeline && (
              <Button onClick={() => setCreateOpen(true)} disabled={isDemo || loading}>
                <Plus className="mr-2 h-4 w-4" /> Criar pipeline
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              disabled={loading || isDemo}
              aria-label="Atualizar pipeline"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {loading && <p className="mt-6 text-sm text-muted-foreground">Carregando pipeline...</p>}
        {!loading && !pipeline && !error && (
          <div className="mt-6 rounded-xl border border-dashed p-7 text-center">
            <Tag className="mx-auto mb-3 h-6 w-6 text-primary" />
            <p className="font-semibold">Crie seu primeiro pipeline</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Depois, adicione as etapas do seu atendimento e mova os leads entre elas.
            </p>
          </div>
        )}
        {!loading && pipeline && (
          <>
            <div className="relative mt-5 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar lead"
                className="pl-9"
              />
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={columnCollision}
              onDragStart={(event) => setActiveLeadKey(String(event.active.id))}
              onDragCancel={() => setActiveLeadKey(null)}
              onDragEnd={handleDragEnd}
            >
              <div className="mt-5 flex gap-3 overflow-x-auto pb-3">
                {columns.map((column) => (
                  <PipelineColumn
                    key={column.id}
                    column={column}
                    leads={filteredLeads.filter(
                      (lead) => (assignmentByKey.get(lead.key) ?? initialStageId) === column.id,
                    )}
                    columns={columns}
                    assignmentByKey={assignmentByKey}
                    initialStageId={initialStageId}
                    isInitial={column.id === initialStageId}
                    disabled={isDemo || movingKey !== null}
                    onMove={(lead, stageId) => void moveLead(lead, stageId)}
                    onEdit={openStageEditor}
                    onDelete={openDeleteStage}
                    canDelete={stages.length > 1}
                  />
                ))}
              </div>
              {createPortal(
                <DragOverlay>
                  {activeLead && (
                    <div className="w-72 rounded-lg border border-primary bg-card p-3 shadow-xl">
                      <p className="truncate text-sm font-semibold">{activeLead.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeLead.phone ?? "Sem telefone"}
                      </p>
                    </div>
                  )}
                </DragOverlay>,
                document.body,
              )}
            </DndContext>
          </>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={(event) => void createPipeline(event)}>
            <DialogHeader>
              <DialogTitle>Criar pipeline</DialogTitle>
              <DialogDescription>
                Defina o nome do pipeline e sua primeira etapa. Todos os leads começarão nela.
              </DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pipeline-name">Nome do pipeline</Label>
                <Input
                  id="pipeline-name"
                  value={pipelineName}
                  onChange={(event) => setPipelineName(event.target.value)}
                  placeholder="Ex.: Atendimento comercial"
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pipeline-initial-stage">Etapa inicial</Label>
                <Input
                  id="pipeline-initial-stage"
                  value={initialStageName}
                  onChange={(event) => setInitialStageName(event.target.value)}
                  placeholder="Ex.: Novo lead"
                  maxLength={80}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !pipelineName.trim() || !initialStageName.trim()}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar pipeline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <form onSubmit={(event) => void createStage(event)}>
            <DialogHeader>
              <DialogTitle>Criar etapa</DialogTitle>
              <DialogDescription>
                Esta etapa será uma etiqueta manual vinculada ao lead.
              </DialogDescription>
            </DialogHeader>
            <Input
              className="my-5"
              value={stageName}
              onChange={(event) => setStageName(event.target.value)}
              placeholder="Ex.: Novo lead"
              maxLength={80}
              required
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStageOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !stageName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar etapa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingStage !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setEditingStage(null);
        }}
      >
        <DialogContent>
          <form onSubmit={(event) => void renameStage(event)}>
            <DialogHeader>
              <DialogTitle>Renomear etapa</DialogTitle>
              <DialogDescription>
                Os leads permanecerão nesta etapa após a mudança do nome.
              </DialogDescription>
            </DialogHeader>
            <Input
              className="my-5"
              value={editStageName}
              onChange={(event) => setEditStageName(event.target.value)}
              maxLength={80}
              autoFocus
              required
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingStage(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !editStageName.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar nome
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deletingStage !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setDeletingStage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar etapa {deletingStage?.name}?</DialogTitle>
            <DialogDescription>
              Escolha para onde mover os {affectedLeads} lead(s) desta etapa antes de apagá-la.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-2">
            <Label>Etapa de destino</Label>
            <Select value={replacementStageId} onValueChange={setReplacementStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages
                  .filter((stage) => stage.id !== deletingStage?.id)
                  .map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingStage(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteStage()}
              disabled={saving || !replacementStageId}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apagar etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
