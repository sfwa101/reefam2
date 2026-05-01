import { createFileRoute } from "@tanstack/react-router";
import HomeStore from "@/pages/store/Home";

// Phase 25: root `/` now serves the SDUI-powered storefront Home
// (LayoutFactory + ui_layouts). The legacy monolithic `pages/Home.tsx`
// was eradicated to remove the visual mask hiding new features.
export const Route = createFileRoute("/_app/")({
  component: HomeStore,
});
