import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bot, Loader2 } from "lucide-react";
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

export default function IaGlobalCard() {
  const [id, setId] = useState<string | null>(null);
  const [ativa, setAtiva] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("configuracoes_ia")
        .select("id, ia_global_ativa")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setAtiva(data.ia_global_ativa);
      } else {
        setAtiva(false);
      }
    };
    load();

    const ch = supabase
      .channel("ia-global-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_ia" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const persist = async (value: boolean) => {
    setSaving(true);
    const prev = ativa;
    setAtiva(value);

    const res = id
      ? await supabase.from("configuracoes_ia").update({ ia_global_ativa: value }).eq("id", id)
      : await supabase.from("configuracoes_ia").insert({ ia_global_ativa: value }).select("id").maybeSingle();

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

  return (
    <Card className="control-card p-5 mb-6 flex items-center justify-between gap-6">
      <div className="flex items-start gap-3">
        <div className="brand-mark h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">IA Global</h3>
          <p className="text-xs text-muted-foreground">Ativa ou desativa a IA para todos os usuários do CRM.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="status-label">
          IA Global: {ativa === null ? "—" : ativa ? "ON" : "OFF"}
        </span>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch checked={!!ativa} disabled={ativa === null || saving} onCheckedChange={onToggle} />
      </div>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar IA global?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso desativará as respostas automáticas da IA para todos os usuários, mesmo para aqueles que estão com a IA individual ativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => persist(false)}>Desativar IA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
