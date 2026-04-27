import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { retryBackendCall } from "@/lib/backendRetry";

export type AppRole =
  | "admin"
  | "staff"
  | "cashier"
  | "store_manager"
  | "collector"
  | "delivery"
  | "finance";

const ALL_ROLES: AppRole[] = [
  "admin",
  "staff",
  "cashier",
  "store_manager",
  "collector",
  "delivery",
  "finance",
];

const normalizeSessionRoles = (sessionRoles: unknown): AppRole[] => {
  if (!Array.isArray(sessionRoles)) return [];
  return sessionRoles.filter((role): role is AppRole =>
    typeof role === "string" && (ALL_ROLES as string[]).includes(role),
  );
};

export function useAdminRole() {
  const { user, session, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const appMeta = user.app_metadata as { role?: unknown; roles?: unknown } | undefined;
      const claimRoles = normalizeSessionRoles(appMeta?.roles);
      if (appMeta?.role === "admin" && !claimRoles.includes("admin")) {
        claimRoles.unshift("admin");
      }
      if (claimRoles.length > 0) {
        setRoles(claimRoles);
        setError(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);
      const { data, error } = await retryBackendCall<any>(
        async () => await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id),
        7,
        500,
      );
      if (cancelled) return;
      if (error) {
        setError(true);
        setLoading(false);
        return;
      }
      setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, session, authLoading]);

  const isStaff = roles.length > 0;
  const isAdmin = roles.includes("admin");
  return { roles, isStaff, isAdmin, loading: loading || authLoading, error };
}