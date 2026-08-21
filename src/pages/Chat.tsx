import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search, Send, Phone, CheckCheck, Bot, Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsDemo } from "@/contexts/AccessContext";
import { demoClientes, demoMessages } from "@/lib/demo-data";

type Cliente = {
  id: string;
  bsuid: string;
  nome: string | null;
  telefone: string | null;
  responded: string | null;
  ia_ativa: boolean;
  created_at: string;
};
type Msg = {
  id: string;
  message_id: string;
  message_text: string | null;
  message_status: string | null;
  who_sent: string | null;
  telefone: string | null;
  created_at: string;
};

const META_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function ChatPage() {
  const isDemo = useIsDemo();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Chat — WhatsApp Automation";
    if (isDemo) {
      setClientes(demoClientes);
      setMessages(demoMessages);
      return;
    }
    const load = async () => {
      const [c, m] = await Promise.all([
        supabase.from("dados_cliente").select("*").order("created_at", { ascending: false }),
        supabase
          .from("webhook_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(2000),
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
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDemo]);

  const filteredClientes = useMemo(() => {
    const q = search.toLowerCase();
    return clientes.filter(
      (c) => !q || c.nome?.toLowerCase().includes(q) || c.telefone?.includes(q),
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

  const lastClientMessage = useMemo(
    () =>
      activeMessages.reduce<Msg | null>((latest, message) => {
        if (message.who_sent !== "client") return latest;
        if (
          !latest ||
          new Date(message.created_at).getTime() > new Date(latest.created_at).getTime()
        ) {
          return message;
        }
        return latest;
      }, null),
    [activeMessages],
  );

  useEffect(() => {
    setCurrentTime(Date.now());
    if (!lastClientMessage) return;

    const expiresAt = new Date(lastClientMessage.created_at).getTime() + META_SERVICE_WINDOW_MS;
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;

    const timeout = window.setTimeout(() => setCurrentTime(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [lastClientMessage]);

  const isMetaWindowOpen = lastClientMessage
    ? currentTime - new Date(lastClientMessage.created_at).getTime() < META_SERVICE_WINDOW_MS
    : false;

  const toggleIa = async (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !c.ia_ativa;
    if (isDemo) {
      setClientes((current) =>
        current.map((cliente) => (cliente.id === c.id ? { ...cliente, ia_ativa: next } : cliente)),
      );
      toast.info("Alteração simulada no ambiente demonstrativo");
      return;
    }
    const { error } = await supabase
      .from("dados_cliente")
      .update({ ia_ativa: next })
      .eq("id", c.id);
    if (error) {
      toast.error("Falha ao atualizar IA: " + error.message);
      return;
    }
    toast.success(
      next
        ? `IA ativada para ${c.nome ?? c.telefone}`
        : `IA desativada para ${c.nome ?? c.telefone}`,
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeMessages.length, activePhone]);

  const sendMessage = async () => {
    if (!input.trim() || !activePhone) return;
    if (!isMetaWindowOpen) {
      toast.error("Janela de 24 horas encerrada", {
        description:
          "Aguarde o cliente enviar uma nova mensagem ou use um template aprovado pela Meta.",
      });
      return;
    }
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

    if (isDemo) {
      window.setTimeout(() => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === localId ? { ...message, message_status: "delivered" } : message,
          ),
        );
        setSending(false);
        toast.info("Mensagem simulada; nenhum envio real foi realizado");
      }, 500);
      return;
    }

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
    <div className="h-[calc(100vh-4rem)] page-content">
      <div className="chat-shell h-full overflow-hidden flex">
        <div
          className={cn(
            "w-full sm:w-[19rem] lg:w-[21rem] shrink-0 border-r flex-col conversation-rail",
            activePhone ? "hidden sm:flex" : "flex",
          )}
        >
          <div className="p-5 border-b">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-[-0.03em]">Conversas</h2>
              <span className="h-2 w-2 rounded-full bg-success" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="border-border bg-card pl-9 placeholder:text-muted-foreground"
              />
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
                    "relative w-full p-4 flex items-start gap-3 border-b text-left transition-colors",
                    active ? "conversation-active" : "hover:bg-muted/45",
                  )}
                >
                  <div className="contact-avatar h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {(c.nome ?? c.telefone ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {c.nome ?? c.telefone ?? "Sem nome"}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.ia_ativa && <Bot className="h-3.5 w-3.5 text-primary" />}
                        {last && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(last.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate">
                        {last?.message_text ?? c.telefone ?? "—"}
                      </p>
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

        <div
          className={cn(
            "relative flex-1 flex-col min-w-0",
            activePhone ? "flex" : "hidden sm:flex",
          )}
        >
          {activePhone ? (
            <>
              <header className="p-5 border-b flex items-center gap-3 bg-card">
                <button
                  type="button"
                  onClick={() => setActivePhone(null)}
                  className="sm:hidden -ml-1 rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Voltar para conversas"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="contact-avatar h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold">
                  {(activeCliente?.nome ?? activePhone).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{activeCliente?.nome ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {activePhone}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2 status-label">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> IA{" "}
                  {activeCliente?.ia_ativa ? "ativa" : "inativa"}
                </div>
              </header>

              <div
                ref={scrollRef}
                className="chat-messages flex-1 overflow-y-auto scrollbar-thin px-5 sm:px-8 py-6 space-y-3 text-sm flex flex-col"
              >
                {activeMessages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground mt-10">
                    Nenhuma mensagem ainda
                  </p>
                )}
                {activeMessages.map((m) => {
                  const isClient = m.who_sent === "client";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className={cn("flex", isClient ? "justify-start" : "justify-end")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                          isClient
                            ? "bg-card border text-foreground rounded-bl-md"
                            : "operator-message text-white rounded-br-md",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {m.message_text}
                        </p>
                        <div
                          className={cn(
                            "text-[10px] mt-1.5 flex items-center gap-1 justify-end",
                            isClient ? "text-muted-foreground" : "text-white/65",
                          )}
                        >
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {!isClient && m.message_status && <span>{m.message_status}</span>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {sending && (
                <motion.div
                  className="relative ml-4 flex w-fit items-center gap-1 rounded-xl bg-white/10 px-3 py-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.6, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse delay-200" />
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse delay-400" />
                </motion.div>
              )}
              <div className="p-4 sm:p-5 border-t bg-card">
                {!isMetaWindowOpen && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Janela de 24 horas encerrada. Aguarde uma nova mensagem do cliente ou use um
                      template aprovado pela Meta.
                    </p>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isMetaWindowOpen
                        ? "Escreva uma mensagem..."
                        : "Envio bloqueado fora da janela de 24 horas"
                    }
                    disabled={sending || !isMetaWindowOpen}
                    autoFocus
                    className="flex-1 bg-background border-border placeholder:text-muted-foreground focus-visible:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim() || !isMetaWindowOpen}
                    aria-label="Enviar mensagem"
                    className="rounded-xl bg-primary p-2.5 text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="empty-state-icon h-20 w-20 mx-auto rounded-2xl flex items-center justify-center mb-4">
                  <Send className="h-8 w-8" />
                </div>
                <h3 className="font-semibold text-lg">Selecione uma conversa</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha um contato à esquerda para iniciar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
