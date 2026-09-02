import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import Campaigns from "@/pages/Campaigns";
import CampaignDetails from "@/pages/CampaignDetails";
import Templates from "@/pages/Templates";
import ProtectedLayout from "@/components/ProtectedLayout";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/campanhas" element={<Campaigns />} />
            <Route path="/campanhas/templates" element={<Templates />} />
            <Route path="/campanhas/:campaignId" element={<CampaignDetails />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
