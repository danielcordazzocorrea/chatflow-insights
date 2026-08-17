import { useEffect, useState } from "react";
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, MessagesSquare, LogOut, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProtectedLayout() {
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "authed" : "anon");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "authed" : "anon");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
  ];

  return (
    <div className="app-shell min-h-screen w-full max-w-[100vw] overflow-hidden flex flex-col">
      <header className="app-header h-16 shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-5 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5 justify-self-start">
          <div className="brand-mark h-9 w-9 rounded-lg flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="font-extrabold text-sm tracking-[0.08em]">WHATS·OPS</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
              Control center
            </p>
          </div>
        </div>

        <nav className="flex h-full min-w-0 -translate-x-4 items-stretch justify-self-center">
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
                    {item.label}
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
            Automação ativa
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
  );
}
