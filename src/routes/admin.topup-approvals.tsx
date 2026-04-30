import { createFileRoute } from "@tanstack/react-router";
import TopupApprovals from "@/pages/admin/TopupApprovals";
export const Route = createFileRoute("/admin/topup-approvals")({ component: TopupApprovals });
