import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ShaderBackground from "@/components/ui/shader-background";
import { toast } from "sonner";
import { MessageCircle, Loader2 } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Login — WhatsApp Automation";
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/dashboard", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Acesso autorizado");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <ShaderBackground />
      <div className="absolute inset-0 pointer-events-none z-0" style={{ background: "var(--gradient-glow)" }} />
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md relative z-10" style={{ boxShadow: "var(--shadow-glow)" }}>
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow" style={{ background: "var(--gradient-primary)" }}>
            <MessageCircle className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold glow-text tracking-tight">SISTEMA INTERNO</h1>
          <p className="text-sm text-muted-foreground mt-1">WhatsApp Automation Control</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operador@empresa.com" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar Sistema"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Acesso restrito. Credenciais gerenciadas pelo administrador.
        </p>
      </div>
    </div>
  );
}
