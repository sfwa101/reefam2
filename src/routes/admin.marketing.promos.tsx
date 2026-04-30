import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/marketing/promos")({
  beforeLoad: () => { throw redirect({ to: "/admin/marketing" }); },
});
