import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import ConstellationGrid from "@/components/ui/constellation-grid";

interface SignInPageProps {
  className?: string;
  onSubmit?: (email: string, password: string) => Promise<void> | void;
  onDemo?: () => Promise<void> | void;
  loading?: boolean;
}

export const SignInPage = ({ className, onSubmit, onDemo, loading = false }: SignInPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (email && password && !loading) await onSubmit?.(email, password);
  };

  return (
    <main
      className={cn(
        "min-h-screen bg-[#070b0d] text-white lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(520px,0.92fr)]",
        className,
      )}
    >
      <ConstellationGrid className="hidden border-r border-white/[0.08] lg:block">
        <section className="flex h-full px-10 py-9 xl:px-16 xl:py-12">
          <div className="flex w-full flex-col">
            <div className="my-auto max-w-2xl">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="max-w-xl"
              >
                <h1 className="text-[clamp(2.4rem,4vw,4.8rem)] font-extrabold leading-[1.02] tracking-[-0.055em]">
                  Gerencie conversas, <span className="text-[#20c873]">campanhas e automações</span>{" "}
                  com eficiência
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
      </ConstellationGrid>

      <section className="flex min-h-screen flex-col bg-[#0a0f12] px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="my-auto w-full max-w-[540px] -translate-y-3 self-center py-6"
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
            className="my-5 text-center text-[10px] text-white/30"
            aria-hidden="true"
          >
            acesso de demonstração
          </div>

          <button
            type="button"
            onClick={() => void onDemo?.()}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.13] bg-white/[0.035] px-5 text-sm font-bold text-white/80 transition hover:border-[#20c873]/55 hover:bg-[#20c873]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c873] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <MonitorPlay className="h-4 w-4 text-[#20c873]" />
            Acesso demo
          </button>
        </motion.div>
        <SecurityNote className="lg:hidden" />
      </section>
    </main>
  );
};

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
