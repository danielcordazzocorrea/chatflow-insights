import { useEffect, useState } from "react";
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, MessageCircleMore, LogOut, RadioTower, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandChatIcon from "@/components/BrandChatIcon";
import { AccessProvider, type AccessRole } from "@/contexts/AccessContext";
import { endDemoSession, hasDemoSession } from "@/lib/demo-auth";

export default function ProtectedLayout() {
  const visualPreview =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has("visual-preview");
  const localDemo = hasDemoSession();
  const [status, setStatus] = useState<"loading" | "authed" | "anon">(
    visualPreview || localDemo ? "authed" : "loading",
  );
  const [role, setRole] = useState<AccessRole>("demo");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (visualPreview || localDemo) return;
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
  }, [localDemo, visualPreview]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (status === "anon") return <Navigate to="/auth" replace state={{ from: location }} />;

  const logout = async () => {
    if (localDemo) {
      endDemoSession();
    } else {
      await supabase.auth.signOut();
    }
    navigate("/auth", { replace: true });
  };

  const nav = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/chat",
      label: "Chat",
      icon: MessageCircleMore,
    },
    {
      to: "/campanhas",
      label: "Campanhas",
      icon: Megaphone,
    },
  ];

  return (
    <AccessProvider value={role}>
      <div className="app-shell min-h-screen w-full max-w-[100vw] overflow-hidden flex flex-col">
        <header className="app-header min-h-[76px] shrink-0 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-4 sm:px-5 lg:px-8">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 justify-self-start">
            <BrandChatIcon className="h-8 w-8" />
            <div className="hidden sm:block">
              <p className="font-bold text-sm tracking-[-0.025em]">
                WHATS<span className="text-primary">·</span>OPS
              </p>
            </div>
          </div>

          <nav className="app-route-nav justify-self-center" aria-label="Navegação principal">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                aria-label={label}
                className={({ isActive }) => `app-route-link${isActive ? " is-active" : ""}`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden="true" />
                <span className="app-route-label">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-1 justify-self-end sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <RadioTower className="h-3.5 w-3.5 text-primary" />
              {role === "demo" ? "Demonstração" : "Sistema online"}
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
