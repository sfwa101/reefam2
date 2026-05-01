import { createFileRoute } from "@tanstack/react-router";
import AnalyticsAdmin from "@/pages/admin/Analytics";
export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsAdmin,
});
