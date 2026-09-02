import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "manage-employees";

type EmployeeResult = { success: true; userId?: string } | { success: false; error: string };

async function callManageEmployees(payload: Record<string, unknown>): Promise<EmployeeResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: payload });

  if (error) {
    // A Edge Function devolve o motivo no corpo mesmo em status 4xx.
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) return { success: false, error: body.error };
      } catch {
        // corpo não era JSON
      }
    }
    return { success: false, error: error.message };
  }

  return data as EmployeeResult;
}

export const createEmployee = (data: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: "admin" | "employee";
  permissions: string[];
}) => callManageEmployees({ action: "create", ...data });

export const approveEmployee = (id: string) => callManageEmployees({ action: "approve", id });

export const rejectEmployee = (id: string) => callManageEmployees({ action: "reject", id });

export const deleteEmployee = (id: string) => callManageEmployees({ action: "delete", id });
