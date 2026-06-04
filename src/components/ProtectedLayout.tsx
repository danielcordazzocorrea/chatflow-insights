import { useEffect, useState } from "react";
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, MessagesSquare, LogOut, MessageCircle } from "lucide-react";
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
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
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
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm tracking-wide glow-text">WHATS·OPS</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Control Center</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_oklch(0.7_0.18_240_/_0.4)]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse-glow" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
