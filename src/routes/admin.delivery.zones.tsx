import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidated under /admin/delivery#zones tab to reduce screen sprawl.
export const Route = createFileRoute("/admin/delivery/zones")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/delivery", hash: "zones" });
  },
});
