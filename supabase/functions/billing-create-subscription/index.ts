import { getAdminContext } from "../_shared/admin.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const asaasUrl = () => Deno.env.get("ASAAS_BASE_URL") || "https://api-sandbox.asaas.com/v3";

type AsaasCustomer = { id?: string };
type AsaasSubscription = { id?: string };
type AsaasPayment = {
  id?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

type Payload = { subscriptionId?: string };

const asaasRequest = async <T>(path: string, apiKey: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${asaasUrl()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      access_token: apiKey,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = (await response.json()) as T & { errors?: unknown };
  if (!response.ok) {
    throw new Error(`Asaas recusou a operação: ${JSON.stringify(body.errors || body)}`);
  }
  return body;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { adminClient } = await getAdminContext(request);
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      return json({
        subscriptionId: payload.subscriptionId,
        status: "pending",
        providerNotConfigured: true,
        paymentOptions: ["PIX", "BOLETO"],
      });
    }

    const payload = (await request.json()) as Payload;
    if (!payload.subscriptionId) return json({ error: "Assinatura não informada." }, 400);

    const { data: subscription, error: subscriptionError } = await adminClient
      .from("billing_subscriptions")
      .select(
        "id, store_id, billing_period, amount_cents, next_due_date, provider_customer_id, provider_subscription_id",
      )
      .eq("id", payload.subscriptionId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription) return json({ error: "Assinatura não encontrada." }, 404);

    const { data: profile, error: profileError } = await adminClient
      .from("billing_customer_profiles")
      .select("id, legal_name, tax_id, email, phone, provider_customer_id")
      .eq("store_id", subscription.store_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.legal_name || !profile.email) {
      return json({ error: "Complete o nome legal e o e-mail do perfil de cobrança." }, 400);
    }

    let customerId = profile.provider_customer_id || subscription.provider_customer_id;
    if (!customerId) {
      const customer = await asaasRequest<AsaasCustomer>("/customers", apiKey, {
        method: "POST",
        body: JSON.stringify({
          name: profile.legal_name,
          cpfCnpj: profile.tax_id,
          email: profile.email,
          phone: profile.phone,
          externalReference: subscription.store_id,
        }),
      });
      customerId = customer.id;
      if (!customerId) return json({ error: "Cliente Asaas não foi criado." }, 502);
      const { error } = await adminClient
        .from("billing_customer_profiles")
        .update({ provider_customer_id: customerId })
        .eq("id", profile.id);
      if (error) throw error;
    }

    let providerSubscriptionId = subscription.provider_subscription_id;
    if (!providerSubscriptionId) {
      const cycle =
        subscription.billing_period === "monthly"
          ? "MONTHLY"
          : subscription.billing_period === "quarterly"
            ? "QUARTERLY"
            : "YEARLY";
      const providerSubscription = await asaasRequest<AsaasSubscription>("/subscriptions", apiKey, {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: subscription.amount_cents / 100,
          cycle,
          nextDueDate: subscription.next_due_date,
          description: "Assinatura da plataforma — Pix ou boleto",
          externalReference: subscription.id,
        }),
      });
      providerSubscriptionId = providerSubscription.id;
      if (!providerSubscriptionId) return json({ error: "Asaas não retornou a assinatura." }, 502);
    }

    const payments = await asaasRequest<{ data?: AsaasPayment[] }>(
      `/subscriptions/${providerSubscriptionId}/payments?limit=1&offset=0`,
      apiKey,
      { method: "GET" },
    );
    const payment = payments.data?.[0];

    const { error: updateSubscriptionError } = await adminClient
      .from("billing_subscriptions")
      .update({
        provider_customer_id: customerId,
        provider_subscription_id: providerSubscriptionId,
        status: "active",
        metadata: { asaas: { id: providerSubscriptionId } },
      })
      .eq("id", subscription.id);
    if (updateSubscriptionError) throw updateSubscriptionError;

    if (payment?.id) {
      const { data: invoice } = await adminClient
        .from("billing_invoices")
        .select("id")
        .eq("subscription_id", subscription.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (invoice?.id) {
        const { error: invoiceError } = await adminClient
          .from("billing_invoices")
          .update({
            provider_payment_id: payment.id,
            invoice_url: payment.invoiceUrl || null,
            bank_slip_url: payment.bankSlipUrl || null,
          })
          .eq("id", invoice.id);
        if (invoiceError) throw invoiceError;
      }
    }

    return json({
      subscriptionId: providerSubscriptionId,
      paymentId: payment?.id || null,
      invoiceUrl: payment?.invoiceUrl || null,
      bankSlipUrl: payment?.bankSlipUrl || null,
      paymentOptions: ["PIX", "BOLETO"],
      status: "active",
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Falha ao criar assinatura." },
      400,
    );
  }
});
