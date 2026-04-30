import { createFileRoute } from "@tanstack/react-router";
import Offers from "@/pages/admin/Offers";
export const Route = createFileRoute("/admin/offers")({ component: Offers });
