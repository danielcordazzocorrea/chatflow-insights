import { useEffect, useState } from "react";
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, MessagesSquare, LogOut, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandChatIcon from "@/components/BrandChatIcon";
import { cn } from "@/lib/utils";
import { AccessProvider, type AccessRole } from "@/contexts/AccessContext";

export default function ProtectedLayout() {
  const visualPreview =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("visual-preview");
  const [status, setStatus] = useState<"loading" | "authed" | "anon">(
    visualPreview ? "authed" : "loading",
  );
  const [role, setRole] = useState<AccessRole>("demo");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (visualPreview) return;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setStatus("anon");
      const { data: profile, error: profileError } = await supabase
        .from("access_profiles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      // Compatibilidade durante a implantação: antes da migração criar a
      // tabela, preserva o comportamento normal da conta já existente.
      // Depois que a tabela existe, ausência de perfil sempre cai em demo.
      const accessTableMissing =
        profileError?.code === "42P01" || profileError?.code === "PGRST205";
      setRole(accessTableMissing || profile?.role === "owner" ? "owner" : "demo");
      setStatus("authed");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setStatus("anon");
    });
    return () => sub.subscription.unsubscribe();
  }, [visualPreview]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (status === "anon") return <Navigate to="/auth" replace state={{ from: location }} />;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/chat", label: "Chat", icon: MessagesSquare },
    { to: "/campanhas", label: "Campanhas", icon: Send },
  ];

  return (
    <AccessProvider value={role}>
      <div className="app-shell min-h-screen w-full max-w-[100vw] overflow-hidden flex flex-col">
        <header className="app-header h-16 shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-5 lg:px-8">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 justify-self-start">
            <BrandChatIcon className="h-9 w-9" />
            <div className="hidden sm:block">
              <p className="font-extrabold text-sm tracking-[0.08em]">WHATS·OPS</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
                Control center
              </p>
            </div>
          </div>

          <nav className="flex h-full min-w-0 items-stretch justify-self-center sm:-translate-x-4">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "relative flex min-w-0 items-center justify-center gap-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                      {isActive && (
                        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-1 justify-self-end sm:gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {role === "demo" ? "Ambiente demonstrativo" : "Automação ativa"}
            </div>
            <Button
              onClick={logout}
              variant="ghost"
              aria-label="Sair"
              className="h-9 px-2.5 sm:px-3 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        <main className="w-full flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </AccessProvider>
  );
}
