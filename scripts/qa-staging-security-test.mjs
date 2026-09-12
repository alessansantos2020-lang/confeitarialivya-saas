import assert from "node:assert/strict";
import fs from "node:fs";

const localEnv = fs.existsSync(".env.local")
  ? Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.trim().startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1).replace(/^\"|\"$/g, "")];
        }),
    )
  : {};

for (const [name, value] of Object.entries(localEnv)) {
  if (process.env[name] === undefined) process.env[name] = value;
}

const WRITE = process.argv.includes("--write");
const target = process.env.QA_TARGET;
const projectRef = process.env.QA_STAGING_PROJECT_REF;
const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const projectId = process.env.VITE_SUPABASE_PROJECT_ID;

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

if (target !== "staging") {
  throw new Error("Refusing to run: set QA_TARGET=staging explicitly.");
}
if (!projectRef || projectId !== projectRef) {
  throw new Error("Refusing to run: VITE_SUPABASE_PROJECT_ID must equal QA_STAGING_PROJECT_REF.");
}
if (!base || new URL(base).hostname !== `${projectRef}.supabase.co`) {
  throw new Error("Refusing to run: VITE_SUPABASE_URL does not match staging project.");
}
if (!publishableKey)
  throw new Error("Missing required environment variable: VITE_SUPABASE_PUBLISHABLE_KEY");

const storeA = required("QA_STORE_A");
const storeB = required("QA_STORE_B");
const productA = required("QA_PRODUCT_A");
const productB = required("QA_PRODUCT_B");
const emailA = required("QA_EMAIL_A");
const emailB = required("QA_EMAIL_B");
const passwordA = required("QA_PASSWORD_A");
const passwordB = required("QA_PASSWORD_B");

const results = [];

const request = async (
  path,
  { method = "GET", body, token = publishableKey, headers = {} } = {},
) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
};

const rest = (table, query = "", options = {}) => request(`/rest/v1/${table}${query}`, options);
const rpc = (name, body, options = {}) =>
  request(`/rest/v1/rpc/${name}`, { method: "POST", body, ...options });
const rows = (result) => (Array.isArray(result.body) ? result.body : []);
const bodyMessage = (result) => {
  if (result.body && typeof result.body === "object" && !Array.isArray(result.body)) {
    return result.body.message || result.body.code || "object response";
  }
  return typeof result.body === "string" ? result.body.slice(0, 120) : "";
};

const run = async (name, callback) => {
  try {
    await callback();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({
      name,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const signIn = async (email, password) => {
  const result = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(result.status, 200, `sign-in failed with status ${result.status}`);
  assert.ok(result.body?.access_token, "sign-in returned no access token");
  assert.ok(result.body?.user?.id, "sign-in returned no user ID");
  return { token: result.body.access_token, userId: result.body.user.id };
};

const expectRows = async (name, table, query, token, predicate) => {
  const result = await rest(table, query, { token });
  assert.equal(result.status, 200, `${name}: status ${result.status}`);
  predicate(rows(result), name);
};

const expectEmpty = (items, name) =>
  assert.equal(items.length, 0, `${name}: expected zero rows, got ${items.length}`);
const expectNonEmpty = (items, name) => assert.ok(items.length > 0, `${name}: expected rows`);

const sessionA = await signIn(emailA, passwordA);
const sessionB = await signIn(emailB, passwordB);
const tokenA = sessionA.token;
const tokenB = sessionB.token;
const userA = sessionA.userId;
const userB = sessionB.userId;

await run("RLS user A reads own products", () =>
  expectRows(
    "own products",
    "products",
    `?select=id&store_id=eq.${storeA}`,
    tokenA,
    expectNonEmpty,
  ),
);
await run("RLS user A cannot read store B products", () =>
  expectRows("other products", "products", `?select=id&store_id=eq.${storeB}`, tokenA, expectEmpty),
);
await run("RLS user A cannot read store B", () =>
  expectRows("other store", "stores", `?select=id&id=eq.${storeB}`, tokenA, expectEmpty),
);
await run("RLS user B cannot read store A products", () =>
  expectRows("cross products", "products", `?select=id&store_id=eq.${storeA}`, tokenB, expectEmpty),
);
await run("RLS user A reads own profile only", async () => {
  await expectRows("own profile", "profiles", `?select=id&id=eq.${userA}`, tokenA, expectNonEmpty);
  await expectRows("other profile", "profiles", `?select=id&id=eq.${userB}`, tokenA, expectEmpty);
});
await run("RLS user A reads own role only", async () => {
  await expectRows(
    "own role",
    "user_roles",
    `?select=user_id,role&user_id=eq.${userA}`,
    tokenA,
    expectNonEmpty,
  );
  await expectRows(
    "other role",
    "user_roles",
    `?select=user_id,role&user_id=eq.${userB}`,
    tokenA,
    expectEmpty,
  );
});
await run("RLS user A cannot read store B operational data", async () => {
  await expectRows(
    "other memberships",
    "store_members",
    `?select=store_id,user_id&store_id=eq.${storeB}`,
    tokenA,
    expectEmpty,
  );
  await expectRows(
    "other orders",
    "orders",
    `?select=id&store_id=eq.${storeB}`,
    tokenA,
    expectEmpty,
  );
  await expectRows(
    "other order items",
    "order_items",
    `?select=id&store_id=eq.${storeB}`,
    tokenA,
    expectEmpty,
  );
  await expectRows(
    "other categories",
    "categories",
    `?select=id&store_id=eq.${storeB}`,
    tokenA,
    expectEmpty,
  );
  await expectRows(
    "other delivery fees",
    "delivery_fees",
    `?select=id&store_id=eq.${storeB}`,
    tokenA,
    expectEmpty,
  );
});
await run("RLS blocks cross-tenant product update", async () => {
  const result = await rest("products", `?id=eq.${productB}`, {
    method: "PATCH",
    body: { description: "security probe" },
    token: tokenA,
    headers: { Prefer: "return=representation" },
  });
  assert.ok(
    result.status >= 400 || rows(result).length === 0,
    `unexpected cross-tenant update: ${result.status}`,
  );
});
await run("Direct catalog reads stay private", async () => {
  for (const table of [
    "stores",
    "categories",
    "products",
    "addon_groups",
    "addons",
    "delivery_fees",
    "store_settings",
  ]) {
    const result = await rest(table, "?select=id&limit=1");
    assert.ok(result.status >= 400, `${table}: anonymous direct read returned ${result.status}`);
  }
});
await run("Public store RPC is tenant-scoped and hides owner", async () => {
  const result = await rpc("get_public_store", { _store_id: storeA });
  assert.equal(result.status, 200, `public store status ${result.status}`);
  assert.equal(result.body?.store?.owner_id, null, "public store leaked owner_id");
  assert.equal(result.body?.store?.id, storeA, "public store returned wrong store");
});
await run("Public catalog RPC is tenant-scoped", async () => {
  const result = await rpc("get_public_catalog", { _store_id: storeA });
  assert.equal(result.status, 200, `public catalog status ${result.status}`);
  const text = JSON.stringify(result.body);
  assert.match(text, new RegExp(productA), "public catalog omitted store A product");
  assert.doesNotMatch(text, new RegExp(productB), "public catalog leaked store B product");
});
await run("Public delivery-fee RPC is available", async () => {
  const result = await rpc("get_public_delivery_fees", { _store_id: storeA });
  assert.equal(result.status, 200, `delivery fees status ${result.status}`);
  assert.ok(rows(result).length > 0, "public delivery-fee RPC returned no fixture rows");
});
await run("Checkout rejects malformed payload", async () => {
  const result = await rpc("create_order", { _payload: {} });
  assert.ok(
    result.status >= 400,
    `malformed checkout returned ${result.status}: ${bodyMessage(result)}`,
  );
});
await run("Direct order insert is blocked", async () => {
  const result = await rest("orders", "", {
    method: "POST",
    body: {
      store_id: storeA,
      customer_name: "security probe",
      customer_phone: "11999999999",
      address: "probe",
    },
    token: tokenA,
    headers: { Prefer: "return=minimal" },
  });
  assert.ok(result.status >= 400, `direct order insert returned ${result.status}`);
});

if (WRITE) {
  await run("Checkout ignores client financial values", async () => {
    const catalog = await rpc("get_public_catalog", { _store_id: storeA });
    const fees = await rpc("get_public_delivery_fees", { _store_id: storeA });
    const categories = rows(catalog);
    const product = categories
      .flatMap((category) => category.products || [])
      .find((item) => item.id === productA);
    const fee = rows(fees).find((item) => item.neighborhood);
    assert.ok(product && fee, "missing checkout fixture");

    const clientTotal = 0.01;
    const clientFee = 0.01;
    const selectedAddons = (product.addons || [])
      .filter((relation) => relation.group?.is_required || Number(relation.group?.min_quantity) > 0)
      .map((relation) => relation.group?.items?.[0])
      .filter((addon) => addon?.id)
      .map((addon) => ({ id: addon.id }));
    assert.ok(selectedAddons.length > 0, "missing required addon fixture");
    const result = await rpc("create_order", {
      _payload: {
        store_id: storeA,
        customer_name: "QA Security Test",
        customer_phone: "11999999999",
        address: `Rua QA, 1 - ${fee.neighborhood}`,
        neighborhood: fee.neighborhood,
        street: "Rua QA",
        number: "1",
        payment_method: "pix",
        total_amount: clientTotal,
        delivery_fee: clientFee,
        items: [
          {
            product_id: productA,
            quantity: 1,
            product_name: "FAKE",
            price_at_time: clientTotal,
            selected_addons: selectedAddons,
          },
        ],
      },
    });
    assert.equal(result.status, 200, `checkout status ${result.status}: ${bodyMessage(result)}`);
    const expectedTotal = Number(product.effective_price ?? product.price) + Number(fee.fee);
    assert.equal(Number(result.body?.delivery_fee), Number(fee.fee));
    assert.equal(Number(result.body?.total_amount), expectedTotal);
    assert.notEqual(Number(result.body?.total_amount), clientTotal);
    assert.equal(
      Number(result.body?.order_items?.[0]?.price_at_time),
      Number(product.effective_price ?? product.price),
    );
  });

  await run("Audit RPC derives actor from session", async () => {
    const result = await rpc(
      "append_audit_log",
      {
        _action: "settings_updated",
        _module: "configuracoes",
        _store_id: storeA,
        _description: `QA persistent security test ${new Date().toISOString()}`,
      },
      { token: tokenA },
    );
    assert.equal(result.status, 204, `audit status ${result.status}: ${bodyMessage(result)}`);
  });
} else {
  results.push({
    name: "Write probes",
    status: "skipped",
    message: "pass --write to create checkout and audit fixtures",
  });
}

const failed = results.filter((result) => result.status === "failed");
console.log(
  JSON.stringify(
    {
      mode: WRITE ? "write" : "read-only",
      target: "staging",
      projectRef,
      passed: results.filter((result) => result.status === "passed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: failed.length,
      results,
    },
    null,
    2,
  ),
);

if (failed.length > 0) process.exitCode = 1;
