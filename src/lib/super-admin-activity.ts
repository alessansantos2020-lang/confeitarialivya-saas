import { supabase } from "@/integrations/supabase/client";

export type ActivityLog = {
  id: string;
  action: string;
  module: string;
  description: string | null;
  actor_email: string | null;
  created_at: string;
};

export const getRecentActivity = async (limit = 10): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, module, description, actor_email, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ActivityLog[];
};
