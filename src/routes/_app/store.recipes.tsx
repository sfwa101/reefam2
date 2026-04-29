import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/store/Recipes";

type RecipesSearch = { tag: string };

export const Route = createFileRoute("/_app/store/recipes")({
  validateSearch: (search: Record<string, unknown>): RecipesSearch => ({
    tag: typeof search.tag === "string" ? search.tag : "",
  }),
  component: Page,
});
