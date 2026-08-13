import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SignInPage } from "@/components/ui/sign-in-flow-1";
import { toast } from "sonner";

export default function AuthPage() {
  const navigate = useNavigate();
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

  return <SignInPage onSubmit={handleLogin} loading={loading} />;
}
