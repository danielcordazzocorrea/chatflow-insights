import { useCallback, useEffect, useState } from "react";
import { Eye, FileText, Languages, RefreshCw, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useIsDemo } from "@/contexts/AccessContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Template = Tables<"templates_meta">;
type TemplateWithLinks = Template & { campanha_templates?: { campanha_id: number }[] };
type LegacyTemplate = Record<string, unknown>;

function readLegacyTemplates(value: unknown): LegacyTemplate[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.filter((item): item is LegacyTemplate =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)),
  );
}

const templateComponents = (template: TemplateWithLinks | null) => {
  if (!template || !template.payload || typeof template.payload !== "object") return [];
  const payload = template.payload as Record<string, unknown>;
  return Array.isArray(payload.components) ? (payload.components as Record<string, unknown>[]) : [];
};

async function loadLegacyLibrary(): Promise<TemplateWithLinks[]> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("id,created_at,created_by,templates_meta");
  if (error) throw error;
  const library = new Map<string, TemplateWithLinks>();
  (data ?? []).forEach((campaign) => {
    readLegacyTemplates(campaign.templates_meta).forEach((payload, index) => {
      const name = String(payload.name ?? `template_${campaign.id}_${index + 1}`);
      const language = String(payload.language ?? "pt_BR");
      const key = `${name}:${language}`;
      const current = library.get(key);
      const campaignLinks = current?.campanha_templates ?? [];
      if (!campaignLinks.some((link) => link.campanha_id === campaign.id)) {
        campaignLinks.push({ campanha_id: campaign.id });
      }
      library.set(key, {
        id: current?.id ?? -(library.size + 1),
        created_by: campaign.created_by ?? "legacy",
        name,
        language,
        category: String(payload.category ?? "MARKETING"),
        status: String(payload.status ?? "PENDING"),
        meta_id: payload.meta_id ? String(payload.meta_id) : null,
        payload: payload as Template["payload"],
        created_at: String(payload.submitted_at ?? campaign.created_at),
        updated_at: String(payload.submitted_at ?? campaign.created_at),
        campanha_templates: campaignLinks,
      });
    });
  });
  return [...library.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const previewTemplates: TemplateWithLinks[] = [
  {
    id: 1,
    created_by: "preview",
    name: "boas_vindas_maio",
    language: "pt_BR",
    category: "MARKETING",
    status: "APPROVED",
    meta_id: "preview-1",
    payload: { components: [{ type: "BODY", text: "Olá {{1}}, seja bem-vindo!" }] },
    created_at: "2026-08-18T13:20:00Z",
    updated_at: "2026-08-18T13:20:00Z",
    campanha_templates: [{ campanha_id: 1 }, { campanha_id: 3 }],
  },
  {
    id: 2,
    created_by: "preview",
    name: "promocao_inverno",
    language: "pt_BR",
    category: "MARKETING",
    status: "PENDING",
    meta_id: "preview-2",
    payload: { components: [{ type: "BODY", text: "Aproveite nossa oferta especial." }] },
    created_at: "2026-08-20T10:00:00Z",
    updated_at: "2026-08-20T10:00:00Z",
    campanha_templates: [{ campanha_id: 2 }],
  },
];

const statusClass = (status: string) =>
  status === "APPROVED"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
    : status === "REJECTED"
      ? "border-red-400/20 bg-red-400/10 text-red-300"
      : "border-amber-400/20 bg-amber-400/10 text-amber-300";

export default function Templates() {
  const isDemo = useIsDemo();
  const visualPreview =
    isDemo ||
    (import.meta.env.DEV && new URLSearchParams(window.location.search).has("visual-preview"));
  const [templates, setTemplates] = useState<TemplateWithLinks[]>(
    visualPreview ? previewTemplates : [],
  );
  const [loading, setLoading] = useState(!visualPreview);
  const [selected, setSelected] = useState<TemplateWithLinks | null>(null);

  const load = useCallback(async () => {
    if (visualPreview) return;
    setLoading(true);
    const syncResult = await supabase.functions.invoke("sync-meta-templates");
    if (syncResult.error) {
      toast.warning("Não foi possível atualizar o status com a Meta", {
        description: syncResult.error.message,
      });
    }
    const { data, error } = await supabase
      .from("templates_meta")
      .select("*,campanha_templates(campanha_id)")
      .order("created_at", { ascending: false });
    if (error?.code === "PGRST205" || error?.code === "42P01") {
      try {
        setTemplates(await loadLegacyLibrary());
      } catch (legacyError) {
        toast.error("Não foi possível carregar os templates", {
          description: legacyError instanceof Error ? legacyError.message : String(legacyError),
        });
      }
    } else if (error) {
      toast.error("Não foi possível carregar os templates", { description: error.message });
    } else {
      setTemplates((data as TemplateWithLinks[] | null) ?? []);
    }
    setLoading(false);
  }, [visualPreview]);

  useEffect(() => {
    document.title = "Templates — WhatsApp Automation";
    void load();
  }, [load]);

  return (
    <div className="page-content scrollbar-hidden h-[calc(100vh-4rem)] overflow-y-auto p-4 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.04em] lg:text-4xl">Templates</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Biblioteca reutilizável de templates enviados à Meta.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} aria-label="Atualizar templates">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </header>

        <nav className="mb-5 flex w-fit rounded-xl border bg-card/40 p-1 text-sm font-semibold">
          <Link
            to="/campanhas"
            className="rounded-lg px-4 py-2 text-muted-foreground transition hover:text-foreground"
          >
            Campanhas
          </Link>
          <span className="rounded-lg bg-sky-400/15 px-4 py-2 text-sky-300">Templates</span>
        </nav>

        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Todos os templates</h2>
            <p className="text-xs text-muted-foreground">
              Crie um template dentro de uma campanha e reutilize-o nas demais.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{templates.length} templates</span>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(template)}
              onKeyDown={(event) => event.key === "Enter" && setSelected(template)}
              className="control-card cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-sky-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
                  <FileText className="h-5 w-5" />
                </span>
                <Badge variant="outline" className={statusClass(template.status)}>
                  {template.status}
                </Badge>
              </div>
              <h3 className="mt-4 truncate text-lg font-bold">{template.name}</h3>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Languages className="h-3.5 w-3.5" />
                  {template.language}
                </span>
                <span>{template.category}</span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Send className="h-3.5 w-3.5" />
                  Usado em {template.campanha_templates?.length ?? 0} campanha(s)
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-sky-300">
                  <Eye className="h-3.5 w-3.5" /> Ver template
                </span>
              </div>
            </Card>
          ))}
        </section>

        {!loading && !templates.length && (
          <Card className="control-card flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Nenhum template criado. Abra uma campanha e use “Criar template”.
          </Card>
        )}
      </div>

      <TemplateDetails template={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

function TemplateDetails({
  template,
  onOpenChange,
}: {
  template: TemplateWithLinks | null;
  onOpenChange: (open: boolean) => void;
}) {
  const components = templateComponents(template);
  const header = components.find((component) => component.type === "HEADER");
  const body = components.find((component) => component.type === "BODY");
  const footer = components.find((component) => component.type === "FOOTER");
  const buttons = components.find((component) => component.type === "BUTTONS");
  const buttonItems = Array.isArray(buttons?.buttons)
    ? (buttons.buttons as Record<string, unknown>[])
    : [];

  return (
    <Dialog open={Boolean(template)} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template?.name}</DialogTitle>
          <DialogDescription>
            {template?.category} · {template?.language} · {template?.status}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-[#0b141a] p-4">
          <div className="overflow-hidden rounded-lg bg-[#202c33] shadow-xl">
            <div className="p-4">
              {header?.text && (
                <p className="mb-2 font-bold text-[#e9edef]">{String(header.text)}</p>
              )}
              <p className="min-h-16 whitespace-pre-wrap text-sm leading-5 text-[#e9edef]">
                {String(body?.text ?? "Conteúdo não disponível")}
              </p>
              {footer?.text && <p className="mt-3 text-xs text-[#8696a0]">{String(footer.text)}</p>}
            </div>
            {buttonItems.length > 0 && (
              <div className="border-t border-[#374248]">
                {buttonItems.map((button, index) => (
                  <div
                    key={index}
                    className="border-b border-[#374248] px-3 py-2.5 text-center text-xs font-semibold text-[#53bdeb] last:border-0"
                  >
                    {String(button.text ?? "Botão")}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Utilizado em {template?.campanha_templates?.length ?? 0} campanha(s).
        </p>
      </DialogContent>
    </Dialog>
  );
}
