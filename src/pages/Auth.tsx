import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SignInPage } from "@/components/ui/sign-in-flow-1";
import { toast } from "sonner";
import { hasDemoSession, startDemoSession } from "@/lib/demo-auth";

export default function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Entrar Whats·Ops";
    if (hasDemoSession()) {
      navigate("/dashboard", { replace: true });
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/dashboard", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Acesso autorizado");
  };

  const handleDemo = () => {
    startDemoSession();
    toast.success("Demonstração iniciada");
    navigate("/dashboard", { replace: true });
  };

  return <SignInPage onSubmit={handleLogin} onDemo={handleDemo} loading={loading} />;
}
