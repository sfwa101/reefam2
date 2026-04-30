import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/marketing/banners")({
  beforeLoad: () => { throw redirect({ to: "/admin/marketing" }); },
});
