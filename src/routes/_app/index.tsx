import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/Home";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});