import { createFileRoute } from "@tanstack/react-router";
import PrintJobsAdmin from "@/pages/admin/PrintJobs";
export const Route = createFileRoute("/admin/print-jobs")({
  component: PrintJobsAdmin,
});
