import { createFileRoute } from "@tanstack/react-router";
import AdminNotifications from "@/pages/admin/Notifications";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
});