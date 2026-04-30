import { createFileRoute } from "@tanstack/react-router";
import Finance from "@/pages/admin/Finance";
export const Route = createFileRoute("/admin/finance")({ component: Finance });
