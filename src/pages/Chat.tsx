import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Search, Send, Phone, CheckCheck, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Cliente = { id: string; bsuid: string; nome: string | null; telefone: string | null; responded: string | null; ia_ativa: boolean; created_at: string };
type Msg = { id: string; message_id: string; message_text: string | null; message_status: string | null; who_sent: string | null; telefone: string | null; created_at: string };

export default function ChatPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Chat — WhatsApp Automation";
    const load = async () => {
      const [c, m] = await Promise.all([
        supabase.from("dados_cliente").select("*").order("created_at", { ascending: false }),
        supabase.from("webhook_messages").select("*").order("created_at", { ascending: true }).limit(2000),
      ]);
      setClientes((c.data as Cliente[]) ?? []);
      setMessages((m.data as Msg[]) ?? []);
    };
    load();

    const ch = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_messages" }, (p) => {
        if (p.eventType === "INSERT") setMessages((prev) => [...prev, p.new as Msg]);
        else load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dados_cliente" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredClientes = useMemo(() => {
    const q = search.toLowerCase();
    return clientes.filter((c) =>
      !q || c.nome?.toLowerCase().includes(q) || c.telefone?.includes(q),
    );
  }, [clientes, search]);

  const lastMsgByPhone = useMemo(() => {
    const m = new Map<string, Msg>();
    for (const msg of messages) {
      if (!msg.telefone) continue;
      m.set(msg.telefone, msg);
    }
    return m;
  }, [messages]);

  const activeMessages = useMemo(
    () => messages.filter((m) => m.telefone === activePhone),
    [messages, activePhone],
  );

  const activeCliente = useMemo(
    () => clientes.find((c) => c.telefone === activePhone) ?? null,
    [clientes, activePhone],
  );

  const toggleIa = async (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !c.ia_ativa;
    const { error } = await supabase.from("dados_cliente").update({ ia_ativa: next }).eq("id", c.id);
    if (error) {
      toast.error("Falha ao atualizar IA: " + error.message);
      return;
    }
    toast.success(next ? `IA ativada para ${c.nome ?? c.telefone}` : `IA desativada para ${c.nome ?? c.telefone}`);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeMessages.length, activePhone]);

  const sendMessage = async () => {
    if (!input.trim() || !activePhone) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    // Otimista: mostra a mensagem na tela imediatamente
    const localId = `local-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        message_id: localId,
        message_text: text,
        message_status: "sending",
        who_sent: "operator",
        telefone: activePhone,
        created_at: new Date().toISOString(),
      },
    ]);

    // Chama a edge function send-whatsapp — ela envia pelo WhatsApp Cloud API
    // e grava em webhook_messages (o canal realtime traz a versão oficial depois).
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      wamid?: string;
      error?: string;
      message?: string;
    }>("send-whatsapp", {
      body: { telefone: activePhone, message: text },
    });

    if (error || !data?.ok) {
      const msg = data?.message || data?.error || error?.message || "Falha ao enviar";
      toast.error("Falha ao enviar: " + msg);
      // remove a mensagem otimista e devolve o texto pro input
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      setInput(text);
      setSending(false);
      return;
    }

    await supabase.from("dados_cliente").update({ responded: "true" }).eq("telefone", activePhone);
    setSending(false);
  };

  return (
    <div className="h-screen p-4 sm:p-6 page-content">
      <div className="chat-shell h-full overflow-hidden rounded-2xl flex">
      <div className="w-[20rem] shrink-0 border-r border-white/10 flex flex-col bg-black/10">
        <div className="p-5 border-b border-white/10">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Inbox</p><h2 className="mt-1 text-lg font-semibold text-white">Conversas</h2></div><span className="h-2 w-2 rounded-full bg-success" /></div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/40" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredClientes.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente</p>
          )}
          {filteredClientes.map((c) => {
            const last = c.telefone ? lastMsgByPhone.get(c.telefone) : null;
            const active = c.telefone === activePhone;
            const responded = c.responded === "true";
            return (
              <button
                key={c.id}
                onClick={() => setActivePhone(c.telefone)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 border-b border-white/5 text-left transition-colors",
                  active ? "bg-primary/12 shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-white/5",
                )}
              >
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 bg-primary text-primary-foreground">
                  {(c.nome ?? c.telefone ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{c.nome ?? c.telefone ?? "Sem nome"}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.ia_ativa && <Bot className="h-3.5 w-3.5 text-primary" />}
                      {last && <span className="text-[10px] text-muted-foreground">{new Date(last.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">{last?.message_text ?? c.telefone ?? "—"}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <label
                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={c.ia_ativa}
                          onCheckedChange={() => {}}
                          onClick={(e) => toggleIa(c, e as unknown as React.MouseEvent)}
                          className="data-[state=checked]:bg-primary"
                        />
                        IA
                      </label>
                      {responded ? (
                        <CheckCheck className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-1 flex flex-col min-w-0">
        {activePhone ? (
          <>
            <header className="p-5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold bg-primary text-primary-foreground">
                {(activeCliente?.nome ?? activePhone).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{activeCliente?.nome ?? "Cliente"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {activePhone}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 status-label"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> IA {activeCliente?.ia_ativa ? "ativa" : "inativa"}</div>
            </header>

            <div ref={scrollRef} className="chat-messages flex-1 overflow-y-auto scrollbar-thin px-6 py-6 space-y-3 text-sm flex flex-col">
              {activeMessages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-10">Nenhuma mensagem ainda</p>
              )}
              {activeMessages.map((m) => {
                const isClient = m.who_sent === "client";
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={cn("flex", isClient ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                        isClient
                          ? "bg-white/8 border border-white/8 text-white rounded-bl-md"
                          : "bg-primary text-primary-foreground font-semibold rounded-br-md",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.message_text}</p>
                      <div className={cn("text-[10px] mt-1.5 flex items-center gap-1 justify-end", isClient ? "text-white/50" : "text-primary-foreground/70")}>
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {!isClient && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {sending && <motion.div className="relative ml-4 flex w-fit items-center gap-1 rounded-xl bg-white/10 px-3 py-2" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}><span className="h-2 w-2 rounded-full bg-white animate-pulse" /><span className="h-2 w-2 rounded-full bg-white animate-pulse delay-200" /><span className="h-2 w-2 rounded-full bg-white animate-pulse delay-400" /></motion.div>}
            <div className="p-5 border-t border-white/10 bg-white/[0.02]">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  disabled={sending}
                  autoFocus
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-primary"
                />
                <button type="submit" disabled={sending || !input.trim()} aria-label="Enviar mensagem" className="rounded-xl bg-primary p-2.5 text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-20 w-20 mx-auto rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow bg-primary text-primary-foreground">
                <Send className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg">Selecione uma conversa</h3>
              <p className="text-sm text-white/50">Escolha um contato à esquerda para iniciar</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
