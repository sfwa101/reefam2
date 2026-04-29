import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import Page from "@/pages/store/Recipes";

const recipesSearchSchema = z.object({
  tag: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_app/store/recipes")({
  validateSearch: zodValidator(recipesSearchSchema),
  component: Page,
});
