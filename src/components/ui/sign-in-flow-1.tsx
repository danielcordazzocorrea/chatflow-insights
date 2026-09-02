import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MessageCircleMore,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Velaris from "@/components/ui/velaris";

interface SignInPageProps {
  className?: string;
  onSubmit?: (email: string, password: string) => Promise<void> | void;
  loading?: boolean;
}

const demoCredentials = { email: "user@example.com", password: "password" };
export const SignInPage = ({ className, onSubmit, loading = false }: SignInPageProps) => {
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (email && password && !loading) await onSubmit?.(email, password);
  };

  const copyCredential = async (key: "email" | "password") => {
    await navigator.clipboard.writeText(demoCredentials[key]);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const accessDetails = (
    <div className="rounded-lg border border-white/[0.11] bg-[#080c0f] px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold">Acesso demonstrativo</h3>
        <button
          type="button"
          onClick={() => {
            setEmail(demoCredentials.email);
            setPassword(demoCredentials.password);
          }}
          className="shrink-0 text-[11px] font-bold text-[#20c873] transition hover:text-[#50e596] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c873]"
        >
          Preencher
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["email", "password"] as const).map((key) => (
          <div
            key={key}
            className="flex min-w-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-white/30">
                {key === "email" ? "E-mail" : "Senha"}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-white/70">
                {demoCredentials[key]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyCredential(key)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/38 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c873]"
              aria-label={`Copiar ${key === "email" ? "e-mail" : "senha"}`}
            >
              {copied === key ? (
                <Check className="h-4 w-4 text-[#20c873]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main
      className={cn(
        "min-h-screen bg-[#070b0d] text-white lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(520px,0.92fr)]",
        className,
      )}
    >
      <Velaris
        bg="#020706"
        colors={["#07130e", "#0b3d29", "#063821", "#000000"]}
        speed={0.75}
        grain={0.18}
        className="hidden border-r border-white/[0.08] lg:block"
      >
        <section className="flex h-full px-10 py-9 xl:px-16 xl:py-12">
          <div className="flex w-full flex-col">
            <Brand />
            <div className="my-auto max-w-2xl">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="max-w-xl"
              >
                <h1 className="text-[clamp(2.4rem,4vw,4.8rem)] font-extrabold leading-[1.02] tracking-[-0.055em]">
                  Gerencie conversas, <span className="text-[#20c873]">campanhas e automações</span>{" "}
                  com eficiência.
                </h1>
                <p className="mt-7 max-w-md text-base leading-7 text-white/65 xl:text-lg">
                  Centralize o atendimento do WhatsApp e mantenha sua operação fluindo em um só
                  lugar.
                </p>
              </motion.div>
            </div>
            <SecurityNote className="justify-start" />
          </div>
        </section>
      </Velaris>

      <section className="flex min-h-screen flex-col bg-[#0a0f12] px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
        <div className="lg:hidden">
          <Brand />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="my-auto w-full max-w-[540px] self-center py-6"
        >
          <div className="mb-7">
            <h2 className="text-3xl font-extrabold tracking-[-0.045em] sm:text-[2.6rem]">
              Entre na sua operação
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/60 sm:text-base">
              Acesso administrativo
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="E-mail">
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-14 w-full rounded-lg border border-white/[0.13] bg-[#080c0f] px-4 text-[15px] text-white outline-none transition placeholder:text-white/25 hover:border-white/25 focus:border-[#20c873] focus:ring-2 focus:ring-[#20c873]/15"
                placeholder="operador@empresa.com"
                required
              />
            </Field>

            <Field label="Senha">
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-lg border border-white/[0.13] bg-[#080c0f] px-4 pr-12 text-[15px] text-white outline-none transition placeholder:text-white/25 hover:border-white/25 focus:border-[#20c873] focus:ring-2 focus:ring-[#20c873]/15"
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-md text-white/45 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c873]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="group flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#20c873] px-5 text-[15px] font-extrabold text-[#03150b] transition hover:bg-[#2ed981] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c873] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f12] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Entrar no painel</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div
            className="my-5 flex items-center gap-4 text-[10px] text-white/30"
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-white/[0.09]" />
            acesso de demonstração
            <span className="h-px flex-1 bg-white/[0.09]" />
          </div>

          {accessDetails}
        </motion.div>
        <SecurityNote className="lg:hidden" />
      </section>
    </main>
  );
};

const Brand = () => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#20c873] text-[#03150b] shadow-[0_10px_30px_rgba(32,200,115,0.16)]">
      <MessageCircleMore className="h-5 w-5" strokeWidth={2.5} />
    </div>
    <div>
      <p className="text-xl font-extrabold tracking-[-0.035em]">
        Whats<span className="text-[#20c873]">·</span>Ops
      </p>
      <p className="mt-0.5 text-xs font-medium tracking-wide text-white/45">
        Operação de atendimento
      </p>
    </div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label
      htmlFor={label === "E-mail" ? "email" : "password"}
      className="text-sm font-semibold text-white/80"
    >
      {label}
    </label>
    {children}
  </div>
);

const SecurityNote = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex items-center justify-center gap-2 text-[11px] font-medium text-white/30",
      className,
    )}
  >
    <LockKeyhole className="h-3.5 w-3.5 text-[#20c873]" />
    Ambiente protegido · Acesso restrito
  </div>
);
