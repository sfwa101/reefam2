import { createFileRoute } from "@tanstack/react-router";
import DesignEditor from "@/pages/admin/DesignEditor";
export const Route = createFileRoute("/admin/design")({
  component: DesignEditor,
});
