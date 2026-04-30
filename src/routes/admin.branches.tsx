import { createFileRoute } from "@tanstack/react-router";
import Branches from "@/pages/admin/Branches";
import { RoleGuard } from "@/components/admin/RoleGuard";

export const Route = createFileRoute("/admin/branches")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <Branches />
    </RoleGuard>
  ),
});
