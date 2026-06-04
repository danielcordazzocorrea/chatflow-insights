import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, Phone, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Cliente = { id: string; bsuid: string; nome: string | null; telefone: string | null; responded: string | null; created_at: string };
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeMessages.length, activePhone]);

  const sendMessage = async () => {
    if (!input.trim() || !activePhone) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    const { error } = await supabase.from("webhook_messages").insert({
      message_id: `local-${crypto.randomUUID()}`,
      message_text: text,
      message_status: "sent",
      who_sent: "operator",
      telefone: activePhone,
    });

    await supabase.from("dados_cliente").update({ responded: "true" }).eq("telefone", activePhone);

    if (error) {
      toast.error("Falha ao enviar: " + error.message);
      setInput(text);
    }
    setSending(false);
  };

  return (
    <div className="h-screen flex">
      <div className="w-80 border-r border-border flex flex-col bg-card/40">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-lg mb-3 glow-text">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9" />
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
                  "w-full p-3 flex items-start gap-3 border-b border-border/40 text-left transition-colors",
                  active ? "bg-primary/15" : "hover:bg-card/60",
                )}
              >
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: "var(--gradient-primary)" }}>
                  {(c.nome ?? c.telefone ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{c.nome ?? c.telefone ?? "Sem nome"}</p>
                    {last && <span className="text-[10px] text-muted-foreground shrink-0">{new Date(last.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">{last?.message_text ?? c.telefone ?? "—"}</p>
                    {responded ? (
                      <CheckCheck className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-accent shrink-0 animate-pulse" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {activePhone ? (
          <>
            <header className="p-4 border-b border-border flex items-center gap-3 bg-card/30">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: "var(--gradient-primary)" }}>
                {(activeCliente?.nome ?? activePhone).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{activeCliente?.nome ?? "Cliente"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {activePhone}</p>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin grid-bg p-6 space-y-3">
              {activeMessages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-10">Nenhuma mensagem ainda</p>
              )}
              {activeMessages.map((m) => {
                const isClient = m.who_sent === "client";
                return (
                  <div key={m.id} className={cn("flex", isClient ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-md",
                        isClient
                          ? "bg-secondary border border-border/60 text-secondary-foreground rounded-bl-sm"
                          : "bg-primary text-primary-foreground rounded-br-sm",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.message_text}</p>
                      <div className={cn("text-[10px] mt-1.5 flex items-center gap-1 justify-end", isClient ? "text-muted-foreground" : "text-primary-foreground/70")}>
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {!isClient && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border bg-card/30">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  disabled={sending}
                  autoFocus
                />
                <Button type="submit" disabled={sending || !input.trim()} style={{ background: "var(--gradient-primary)" }}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center grid-bg">
            <div className="text-center">
              <div className="h-20 w-20 mx-auto rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow" style={{ background: "var(--gradient-primary)" }}>
                <Send className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Selecione uma conversa</h3>
              <p className="text-sm text-muted-foreground">Escolha um contato à esquerda para iniciar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
