import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquareReply,
  Phone,
  Plus,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
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

type Campaign = Tables<"campanhas">;
type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
type TemplateButton = { id: string; type: ButtonType; text: string; value: string };

const variableCount = (text: string) => {
  const indexes = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
  return indexes.length ? Math.max(...indexes) : 0;
};

const examples = (value: string, count: number) => {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from({ length: count }, (_, index) => values[index] ?? `Exemplo ${index + 1}`);
};

const buttonDefaults: Record<ButtonType, { text: string; value: string }> = {
  QUICK_REPLY: { text: "Quero saber mais", value: "" },
  URL: { text: "Acessar site", value: "https://" },
  PHONE_NUMBER: { text: "Ligar", value: "+55" },
  COPY_CODE: { text: "Copiar código", value: "EXEMPLO10" },
};

export function CampaignTemplateDialog({
  campaign,
  open,
  onOpenChange,
  onSaved,
}: {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("pt_BR");
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerExamples, setHeaderExamples] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [body, setBody] = useState("");
  const [bodyExamples, setBodyExamples] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const mediaUrl = useMemo(
    () => (media?.type.startsWith("image/") ? URL.createObjectURL(media) : null),
    [media],
  );
  useEffect(
    () => () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    },
    [mediaUrl],
  );

  const addButton = (type: ButtonType) => {
    if (buttons.length >= 10) return toast.error("A Meta permite no máximo 10 botões");
    setButtons((current) => [
      ...current,
      { id: crypto.randomUUID(), type, ...buttonDefaults[type] },
    ]);
  };

  const updateButton = (id: string, values: Partial<TemplateButton>) =>
    setButtons((current) =>
      current.map((button) => (button.id === id ? { ...button, ...values } : button)),
    );

  const reset = () => {
    setName("");
    setHeaderType("NONE");
    setHeaderText("");
    setHeaderExamples("");
    setMedia(null);
    setBody("");
    setBodyExamples("");
    setFooter("");
    setButtons([]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!campaign) return;
    setBusy(true);
    try {
      let mediaHandle: string | null = null;
      if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
        if (!media) throw new Error("Selecione a mídia usada como exemplo do cabeçalho.");
        const form = new FormData();
        form.append("campanha_id", String(campaign.id));
        form.append("file", media);
        const { data, error } = await supabase.functions.invoke<{ handle: string }>(
          "upload-meta-template-media",
          { body: form },
        );
        if (error || !data?.handle)
          throw error ?? new Error("A Meta não devolveu o identificador da mídia.");
        mediaHandle = data.handle;
      }

      const components: Record<string, unknown>[] = [];
      if (headerType === "TEXT" && headerText.trim()) {
        const count = variableCount(headerText);
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: headerText.trim(),
          ...(count ? { example: { header_text: examples(headerExamples, count) } } : {}),
        });
      } else if (headerType !== "NONE") {
        components.push({
          type: "HEADER",
          format: headerType,
          example: { header_handle: [mediaHandle] },
        });
      }

      const bodyCount = variableCount(body);
      components.push({
        type: "BODY",
        text: body.trim(),
        ...(bodyCount ? { example: { body_text: [examples(bodyExamples, bodyCount)] } } : {}),
      });
      if (footer.trim()) components.push({ type: "FOOTER", text: footer.trim() });
      if (buttons.length) {
        components.push({
          type: "BUTTONS",
          buttons: buttons.map((button) => ({
            type: button.type,
            text: button.text.trim(),
            ...(button.type === "URL" ? { url: button.value.trim() } : {}),
            ...(button.type === "PHONE_NUMBER" ? { phone_number: button.value.trim() } : {}),
            ...(button.type === "COPY_CODE" ? { example: button.value.trim() } : {}),
          })),
        });
      }

      const { error } = await supabase.functions.invoke("submit-meta-template", {
        body: {
          campanha_id: campaign.id,
          template: {
            name,
            language,
            category,
            components,
            allow_category_change: true,
          },
        },
      });
      if (error) throw error;
      toast.success("Template enviado à Meta para aprovação");
      reset();
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error("Não foi possível enviar o template", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto border-border bg-popover sm:max-w-5xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Criar template da Meta</DialogTitle>
            <DialogDescription>
              Monte os componentes e confira a prévia antes de enviar para aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    className="mt-2"
                    placeholder="promocao_agosto"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="UTILITY">Utilidade</SelectItem>
                      <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Input
                    className="mt-2"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    required
                  />
                </div>
              </section>

              <TemplateSection title="Cabeçalho" description="Opcional · texto ou mídia">
                <Select
                  value={headerType}
                  onValueChange={(value) => {
                    setHeaderType(value as HeaderType);
                    setMedia(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                    <SelectItem value="TEXT">Texto</SelectItem>
                    <SelectItem value="IMAGE">Imagem</SelectItem>
                    <SelectItem value="VIDEO">Vídeo</SelectItem>
                    <SelectItem value="DOCUMENT">Documento</SelectItem>
                  </SelectContent>
                </Select>
                {headerType === "TEXT" && (
                  <>
                    <Input
                      placeholder="Título do template"
                      value={headerText}
                      onChange={(event) => setHeaderText(event.target.value)}
                      maxLength={60}
                      required
                    />
                    <VariableExamples
                      text={headerText}
                      value={headerExamples}
                      onChange={setHeaderExamples}
                    />
                  </>
                )}
                {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:border-primary/60">
                    <Upload className="h-5 w-5 text-primary" />
                    <span>{media ? media.name : "Selecionar arquivo de exemplo (máx. 16 MB)"}</span>
                    <input
                      className="sr-only"
                      type="file"
                      accept={
                        headerType === "IMAGE"
                          ? "image/jpeg,image/png"
                          : headerType === "VIDEO"
                            ? "video/mp4"
                            : "application/pdf"
                      }
                      onChange={(event) => setMedia(event.target.files?.[0] ?? null)}
                      required
                    />
                  </label>
                )}
              </TemplateSection>

              <TemplateSection
                title="Corpo"
                description="Obrigatório · use {{1}}, {{2}} para variáveis"
              >
                <Textarea
                  className="min-h-32"
                  placeholder="Olá {{1}}, temos uma novidade para você."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
                <VariableExamples text={body} value={bodyExamples} onChange={setBodyExamples} />
              </TemplateSection>

              <TemplateSection title="Rodapé" description="Opcional · até 60 caracteres">
                <Input
                  placeholder="Responda SAIR para não receber mensagens"
                  value={footer}
                  onChange={(event) => setFooter(event.target.value)}
                  maxLength={60}
                />
              </TemplateSection>

              <TemplateSection
                title="Botões"
                description="Opcional · chamadas para ação e respostas rápidas"
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addButton("QUICK_REPLY")}
                  >
                    <MessageSquareReply className="mr-2 h-4 w-4" />
                    Resposta rápida
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addButton("URL")}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Site
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addButton("PHONE_NUMBER")}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Telefone
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addButton("COPY_CODE")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Copiar código
                  </Button>
                </div>
                <div className="space-y-2">
                  {buttons.map((button) => (
                    <div
                      key={button.id}
                      className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[130px_1fr_1fr_auto]"
                    >
                      <Select
                        value={button.type}
                        onValueChange={(value) =>
                          updateButton(button.id, {
                            type: value as ButtonType,
                            ...buttonDefaults[value as ButtonType],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUICK_REPLY">Resposta</SelectItem>
                          <SelectItem value="URL">URL</SelectItem>
                          <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                          <SelectItem value="COPY_CODE">Código</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        aria-label="Texto do botão"
                        value={button.text}
                        onChange={(event) => updateButton(button.id, { text: event.target.value })}
                        maxLength={25}
                        required
                      />
                      {button.type === "QUICK_REPLY" ? (
                        <div />
                      ) : (
                        <Input
                          aria-label="Destino do botão"
                          value={button.value}
                          onChange={(event) =>
                            updateButton(button.id, { value: event.target.value })
                          }
                          required
                        />
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setButtons((current) => current.filter((item) => item.id !== button.id))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TemplateSection>
            </div>

            <TemplatePreview
              headerType={headerType}
              headerText={headerText}
              mediaUrl={mediaUrl}
              mediaName={media?.name}
              body={body}
              footer={footer}
              buttons={buttons}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar para aprovação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-background/25 p-4">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function VariableExamples({
  text,
  value,
  onChange,
}: {
  text: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const count = variableCount(text);
  if (!count) return null;
  return (
    <div>
      <Label className="text-[11px]">Exemplos das {count} variáveis, separados por vírgula</Label>
      <Input
        className="mt-2"
        placeholder="Ana, pedido 123"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

function TemplatePreview({
  headerType,
  headerText,
  mediaUrl,
  mediaName,
  body,
  footer,
  buttons,
}: {
  headerType: HeaderType;
  headerText: string;
  mediaUrl: string | null;
  mediaName?: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
}) {
  const MediaIcon =
    headerType === "VIDEO" ? Video : headerType === "DOCUMENT" ? FileText : ImageIcon;
  return (
    <aside className="lg:sticky lg:top-0 lg:self-start">
      <p className="mb-2 text-xs font-bold text-muted-foreground">PRÉVIA NO WHATSAPP</p>
      <div className="rounded-2xl bg-[#0b141a] p-4 shadow-inner">
        <div className="overflow-hidden rounded-lg bg-[#202c33] shadow-xl">
          {headerType === "IMAGE" && mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Prévia do cabeçalho"
              className="aspect-video w-full object-cover"
            />
          ) : ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) ? (
            <div className="flex aspect-video flex-col items-center justify-center bg-[#182229] text-[#8696a0]">
              <MediaIcon className="mb-2 h-8 w-8" />
              <span className="max-w-56 truncate text-xs">
                {mediaName || headerType.toLowerCase()}
              </span>
            </div>
          ) : null}
          <div className="p-3">
            {headerType === "TEXT" && headerText && (
              <p className="mb-1 text-sm font-bold text-[#e9edef]">{headerText}</p>
            )}
            <p className="min-h-12 whitespace-pre-wrap text-sm leading-5 text-[#e9edef]">
              {body || "Escreva a mensagem do template..."}
            </p>
            {footer && <p className="mt-2 text-[11px] text-[#8696a0]">{footer}</p>}
            <p className="mt-2 text-right text-[10px] text-[#8696a0]">12:00 ✓✓</p>
          </div>
          {buttons.length > 0 && (
            <div className="border-t border-[#374248]">
              {buttons.map((button) => (
                <div
                  key={button.id}
                  className="flex items-center justify-center gap-2 border-b border-[#374248] px-3 py-2.5 text-xs font-semibold text-[#20c873] last:border-0"
                >
                  {button.type === "URL" ? (
                    <Link2 className="h-3.5 w-3.5" />
                  ) : button.type === "PHONE_NUMBER" ? (
                    <Phone className="h-3.5 w-3.5" />
                  ) : (
                    <MessageSquareReply className="h-3.5 w-3.5" />
                  )}
                  {button.text || "Botão"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
