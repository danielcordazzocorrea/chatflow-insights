import { Navigate } from "react-router-dom";
import { useAccessRole } from "@/contexts/AccessContext";
import type { ReactNode } from "react";

export default function OwnerOnly({ children }: { children: ReactNode }) {
  return useAccessRole() === "owner" ? children : <Navigate to="/dashboard" replace />;
}
