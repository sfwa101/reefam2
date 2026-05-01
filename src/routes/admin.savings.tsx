import { createFileRoute } from "@tanstack/react-router";
import SavingsAdmin from "@/pages/admin/Savings";
export const Route = createFileRoute("/admin/savings")({
  component: SavingsAdmin,
});
