import { createFileRoute } from "@tanstack/react-router";
import CFODashboard from "@/pages/admin/CFODashboard";
export const Route = createFileRoute("/admin/cfo")({ component: CFODashboard });
