import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/store/Restaurants";
export const Route = createFileRoute("/_app/store/restaurants")({ component: Page });