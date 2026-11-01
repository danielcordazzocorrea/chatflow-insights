import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BotMessageSquare,
  Menu,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsDemo } from "@/contexts/AccessContext";

type Message = { id: string; role: "user" | "assistant"; text: string; createdAt: string };
type Conversation = { id: string; title: string; messages: Message[] };

const OWNER_STORAGE_KEY = "whats-ops-ai-agent-conversations-v1";
const DEMO_STORAGE_KEY = "whats-ops-ai-agent-demo-preview";
const suggestions = [
  "Resuma os atendimentos de hoje",
  "Quais leads precisam de atenção?",
  "Faça um relatório do pipeline",
];

function readConversations(storageKey: string): Conversation[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter(
        (item): item is Conversation =>
          typeof item?.id === "string" &&
          typeof item?.title === "string" &&
          Array.isArray(item?.messages) &&
          item.messages.every(
            (message: Message) =>
              typeof message?.id === "string" &&
              typeof message?.text === "string" &&
              typeof message?.createdAt === "string",
          ),
      )
      .map((item) => ({
        ...item,
        messages: item.messages.map((message) => ({
          ...message,
          role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
        })),
      }));
  } catch {
    return [];
  }
}

export default function AIAgent() {
  const isDemo = useIsDemo();
  const storageKey = isDemo ? DEMO_STORAGE_KEY : OWNER_STORAGE_KEY;
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    readConversations(storageKey),
  );
  const [activeId, setActiveId] = useState<string | null>(
    () => readConversations(storageKey)[0]?.id ?? null,
  );
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const active = conversations.find((conversation) => conversation.id === activeId);

  useEffect(() => {
    document.title = "Agente IA | Whats·Ops";
  }, []);
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(conversations));
  }, [conversations, storageKey]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeId, active?.messages.length, pendingMessage]);

  const newConversation = () => {
    if (pendingMessage) return;
    setActiveId(null);
    setDraft("");
    setSendError("");
    setSidebarOpen(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pendingMessage) return;
    const id = activeId ?? crypto.randomUUID();
    setSendError("");
    if (isDemo) {
      const message: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        createdAt: new Date().toISOString(),
      };
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.id === id);
        if (existing)
          return current.map((conversation) =>
            conversation.id === id
              ? { ...conversation, messages: [...conversation.messages, message] }
              : conversation,
          );
        return [
          { id, title: text.length > 36 ? `${text.slice(0, 36)}…` : text, messages: [message] },
          ...current,
        ];
      });
      setActiveId(id);
      setDraft("");
      return;
    }
    setPendingMessage(text);
    setDraft("");
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-chat", {
        body: { message: text, sessionId: id },
      });
      if (error) throw error;
      if (typeof data?.reply !== "string" || !data.reply.trim())
        throw new Error("O agente não retornou uma resposta.");
      const createdAt = new Date().toISOString();
      const messages: Message[] = [
        { id: crypto.randomUUID(), role: "user", text, createdAt },
        { id: crypto.randomUUID(), role: "assistant", text: data.reply.trim(), createdAt },
      ];
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.id === id);
        if (existing)
          return current.map((conversation) =>
            conversation.id === id
              ? { ...conversation, messages: [...conversation.messages, ...messages] }
              : conversation,
          );
        return [
          { id, title: text.length > 36 ? `${text.slice(0, 36)}…` : text, messages },
          ...current,
        ];
      });
      setActiveId(id);
    } catch (cause) {
      setDraft(text);
      setSendError(cause instanceof Error ? cause.message : "Não foi possível falar com o agente.");
    } finally {
      setPendingMessage("");
    }
  };

  const deleteConversation = (id: string) => {
    if (pendingMessage) return;
    setConversations((current) => current.filter((conversation) => conversation.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setDraft("");
    }
  };

  return (
    <div className="agent-page">
      {sidebarOpen && (
        <button
          type="button"
          className="agent-sidebar-backdrop"
          aria-label="Fechar conversas"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`agent-sidebar${sidebarOpen ? " agent-sidebar-open" : ""}`}
        aria-label="Conversas do agente"
      >
        <div className="agent-sidebar-top">
          <div>
            <span className="agent-eyebrow">SEU ESPAÇO</span>
            <h2>Conversas</h2>
          </div>
          <button
            type="button"
            className="agent-icon-button agent-mobile-only"
            aria-label="Fechar conversas"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <button type="button" className="agent-new-button" onClick={newConversation}>
          <Plus size={17} /> Nova conversa
        </button>
        <div className="agent-conversation-list">
          {conversations.length === 0 ? (
            <p className="agent-sidebar-empty">Suas conversas desta sessão aparecerão aqui.</p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`agent-conversation${activeId === conversation.id ? " is-active" : ""}`}
              >
                <button
                  type="button"
                  className="agent-conversation-select"
                  onClick={() => {
                    setActiveId(conversation.id);
                    setSidebarOpen(false);
                  }}
                >
                  <MessageSquareText size={16} />
                  <span>{conversation.title}</span>
                </button>
                <button
                  type="button"
                  className="agent-delete-button"
                  aria-label={`Excluir conversa ${conversation.title}`}
                  title="Excluir conversa"
                  onClick={() => deleteConversation(conversation.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
        <p className="agent-sidebar-note">
          {isDemo
            ? "Prévia local: as mensagens ficam apenas nesta sessão do navegador."
            : "Conversas desta sessão. Excluir remove apenas a cópia do navegador."}
        </p>
      </aside>

      <section className="agent-main" aria-label="Conversa com o agente IA">
        <header className="agent-header">
          <button
            type="button"
            className="agent-icon-button agent-mobile-only"
            aria-label="Abrir conversas"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="agent-avatar">
            <BotMessageSquare size={21} />
          </span>
          <div className="agent-header-copy">
            <h1>Agente IA</h1>
            <p>Seu assistente para o CRM</p>
          </div>
          <span className="agent-status">
            <span /> {isDemo ? "Prévia sem IA" : pendingMessage ? "Respondendo" : "Agente CRM"}
          </span>
        </header>

        <div className="agent-messages" aria-live="polite">
          {!active?.messages.length && !pendingMessage ? (
            <div className="agent-welcome">
              <div className="agent-welcome-icon">
                <Sparkles size={28} />
              </div>
              <span className="agent-eyebrow">UM NOVO JEITO DE TRABALHAR</span>
              <h2>Como posso ajudar você?</h2>
              <p>
                {isDemo
                  ? "Explore a interface do agente. No demo, as mensagens não são enviadas e não há respostas da IA."
                  : "Pergunte sobre clientes, histórico de atendimento, etapas do pipeline ou solicite um relatório do CRM."}
              </p>
              <div className="agent-suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setDraft(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="agent-thread">
              {isDemo && (
                <div className="agent-thread-notice">
                  <Sparkles size={17} /> Esta é uma prévia. Nenhuma mensagem foi enviada à IA.
                </div>
              )}
              {active?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`agent-message-row${message.role === "assistant" ? " is-assistant" : ""}`}
                >
                  <div
                    className={`agent-message${message.role === "assistant" ? " is-assistant" : ""}`}
                  >
                    <p>{message.text}</p>
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>
              ))}
              {pendingMessage && (
                <>
                  <div className="agent-message-row">
                    <div className="agent-message">
                      <p>{pendingMessage}</p>
                    </div>
                  </div>
                  <div className="agent-message-row is-assistant">
                    <div className="agent-message is-assistant agent-typing" role="status">
                      O agente está respondendo…
                    </div>
                  </div>
                </>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="agent-composer-wrap">
          <form className="agent-composer" onSubmit={sendMessage}>
            <label htmlFor="agent-message" className="sr-only">
              Mensagem para o agente IA
            </label>
            <textarea
              id="agent-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Escreva sua mensagem..."
              rows={2}
              maxLength={4000}
            />
            <button
              type="submit"
              aria-label="Enviar mensagem"
              disabled={!draft.trim() || !!pendingMessage}
            >
              <Send size={19} />
            </button>
          </form>
          {sendError ? (
            <p className="agent-send-error" role="alert">
              {sendError} Tente enviar novamente.
            </p>
          ) : (
            <p>
              {isDemo
                ? "Prévia local: o agente não está conectado no demo."
                : "O agente pode consultar o CRM. Alterações exigem sua aprovação."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
