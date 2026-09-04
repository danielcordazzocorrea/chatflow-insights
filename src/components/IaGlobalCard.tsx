import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsDemo } from "@/contexts/AccessContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function IaGlobalCard() {
  const isDemo = useIsDemo();
  const [id, setId] = useState<string | null>(null);
  const [ativa, setAtiva] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemMessage, setSystemMessage] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setAtiva(true);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("configuracoes_ia")
        .select("id, ia_global_ativa, system_message")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setAtiva(data.ia_global_ativa);
        setSystemMessage(data.system_message ?? "");
      } else {
        setAtiva(false);
      }
    };
    load();

    const ch = supabase
      .channel("ia-global-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_ia" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDemo]);

  const persist = async (value: boolean) => {
    if (isDemo) {
      setAtiva(value);
      toast.info("Alteração simulada no ambiente demonstrativo");
      return;
    }
    setSaving(true);
    const prev = ativa;
    setAtiva(value);

    const res = id
      ? await supabase.from("configuracoes_ia").update({ ia_global_ativa: value }).eq("id", id)
      : await supabase
          .from("configuracoes_ia")
          .insert({ ia_global_ativa: value })
          .select("id")
          .maybeSingle();

    if (res.error) {
      setAtiva(prev);
      toast.error("Falha ao salvar: " + res.error.message);
    } else {
      if (!id && "data" in res && res.data?.id) setId(res.data.id);
      toast.success(value ? "IA global ativada" : "IA global desativada");
    }
    setSaving(false);
  };

  const onToggle = (value: boolean) => {
    if (!value) setConfirmOff(true);
    else persist(true);
  };

  const saveSystemMessage = async () => {
    if (isDemo) return;
    setSavingPrompt(true);
    const result = id
      ? await supabase
          .from("configuracoes_ia")
          .update({ system_message: systemMessage.trim() })
          .eq("id", id)
      : await supabase
          .from("configuracoes_ia")
          .insert({ ia_global_ativa: ativa ?? true, system_message: systemMessage.trim() })
          .select("id")
          .maybeSingle();
    if (result.error) toast.error("Falha ao salvar: " + result.error.message);
    else {
      if (!id && "data" in result && result.data?.id) setId(result.data.id);
      toast.success("Instruções da IA atualizadas");
      setSettingsOpen(false);
    }
    setSavingPrompt(false);
  };

  return (
    <Card className="ai-control p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="ai-icon h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">Automação de IA</h3>
          <p className="text-xs text-muted-foreground">
            Respostas automáticas para todos os usuários.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <span className="status-label">
          IA Global: {ativa === null ? "—" : ativa ? "ON" : "OFF"}
        </span>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!isDemo && (
          <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" />
            Configurar IA
          </Button>
        )}
        <Switch checked={!!ativa} disabled={ativa === null || saving} onCheckedChange={onToggle} />
      </div>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar IA global?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso desativará as respostas automáticas da IA para todos os usuários, mesmo para
              aqueles que estão com a IA individual ativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => persist(false)}>Desativar IA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="border-border bg-popover sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Instruções da IA automática
            </DialogTitle>
            <DialogDescription>
              Defina como a IA do n8n deve responder seus clientes no WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="automatic-ai-system-message" className="text-sm font-medium">
              System message
            </label>
            <Textarea
              id="automatic-ai-system-message"
              value={systemMessage}
              onChange={(event) => setSystemMessage(event.target.value)}
              maxLength={4000}
              rows={10}
              disabled={savingPrompt}
              placeholder="Ex.: Você é o assistente da empresa. Responda de forma acolhedora, objetiva e profissional. Nunca invente preços ou prazos."
              className="resize-y bg-background"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Essa instrução será aplicada às próximas respostas automáticas.</span>
              <span>{systemMessage.length}/4000</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveSystemMessage} disabled={savingPrompt}>
              {savingPrompt && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar instruções
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
