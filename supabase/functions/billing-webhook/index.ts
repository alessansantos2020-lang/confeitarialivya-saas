import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const statusMap: Record<string, string> = {
  PAYMENT_CREATED: "pending",
  PAYMENT_UPDATED: "pending",
  PAYMENT_CONFIRMED: "confirmed",
  PAYMENT_RECEIVED: "received",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_PARTIALLY_REFUNDED: "refunded",
  PAYMENT_DELETED: "canceled",
  PAYMENT_RESTORED: "pending",
  PAYMENT_FAILED: "failed",
};
const methodMap: Record<string, string> = { PIX: "PIX", BOLETO: "BOLETO" };

type PaymentPayload = {
  id?: string;
  subscription?: string;
  billingType?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  bankSlipBarcode?: string;
  identificationField?: string;
  dueDate?: string;
  value?: number;
  pixQrCode?: string;
  pixCopiaECola?: string;
};
type WebhookPayload = { id?: string; event?: string; payment?: PaymentPayload };

const safeUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const tokensMatch = async (received: string, expected: string): Promise<boolean> => {
  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(receivedHash);
  const b = new Uint8Array(expectedHash);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = request.headers.get("asaas-access-token");
    if (!expectedToken || !receivedToken || !(await tokensMatch(receivedToken, expectedToken))) {
      return json({ error: "Webhook não autorizado." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase secrets ausentes.");
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = (await request.json()) as WebhookPayload;
    if (!body.id || !body.event) return json({ error: "Evento inválido." }, 400);

    const { data: existing } = await adminClient
      .from("billing_webhook_events")
      .select("id, status")
      .eq("provider", "asaas")
      .eq("provider_event_id", body.id)
      .maybeSingle();
    if (existing?.status === "processed") return json({ ok: true, duplicate: true });

    const { error: eventError } = await adminClient.from("billing_webhook_events").upsert(
      {
        provider: "asaas",
        provider_event_id: body.id,
        event_type: body.event,
        payload: body,
        signature_valid: true,
        status: "received",
      },
      { onConflict: "provider,provider_event_id" },
    );
    if (eventError) throw eventError;

    const nextStatus = statusMap[body.event];
    if (nextStatus && body.payment?.id) {
      const { error: rpcError } = await adminClient.rpc("sync_billing_provider_payment", {
        _provider_subscription_id: body.payment.subscription ?? null,
        _provider_payment_id: body.payment.id,
        _status: nextStatus,
        _payment_method: methodMap[body.payment.billingType || ""],
        _invoice_url: safeUrl(body.payment.invoiceUrl),
        _bank_slip_url: safeUrl(body.payment.bankSlipUrl),
        _bank_slip_barcode: body.payment.bankSlipBarcode,
        _bank_slip_digitable_line: body.payment.identificationField,
        _pix_qr_code: body.payment.pixQrCode,
        _pix_copy_paste: body.payment.pixCopiaECola,
        _amount_cents:
          typeof body.payment.value === "number" ? Math.round(body.payment.value * 100) : undefined,
        _due_date: body.payment.dueDate,
      });
      if (rpcError) throw rpcError;
    }

    const { error: processedError } = await adminClient
      .from("billing_webhook_events")
      .update({
        status: nextStatus ? "processed" : "ignored",
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "asaas")
      .eq("provider_event_id", body.id);
    if (processedError) throw processedError;
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha no webhook." }, 500);
  }
});
