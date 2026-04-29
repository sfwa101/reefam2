import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/store/Sweets";
export const Route = createFileRoute("/_app/store/sweets")({ component: Page });