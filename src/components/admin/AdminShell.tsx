import { Outlet } from "@tanstack/react-router";
import { DesktopSidebar } from "./DesktopSidebar";
import { BottomTabBar } from "./BottomTabBar";
import { HakimFAB } from "./HakimFAB";

/**
 * AdminShell — Phase 20 visual unification.
 *
 * The previous shell used a flat `bg-background` that visually clashed
 * with the storefront's iOS-glass language. We now layer an aurora
 * background so the inner glass surfaces (sidebar + bottom nav) read
 * as floating panels — matching the storefront's premium feel.
 *
 * Glass primitives (`glass-strong`, `shadow-float`) are applied inside
 * `DesktopSidebar` and `BottomTabBar` directly so children get the
 * benefit without prop drilling.
 */
export function AdminShell() {
  return (
    <div
      className="min-h-screen flex w-full bg-background"
      dir="rtl"
      style={{ background: "var(--gradient-aurora), hsl(var(--background))" }}
    >
      <DesktopSidebar />
      <main className="flex-1 min-w-0 pb-tab lg:pb-0">
        <Outlet />
      </main>
      <BottomTabBar />
      <HakimFAB />
    </div>
  );
}
