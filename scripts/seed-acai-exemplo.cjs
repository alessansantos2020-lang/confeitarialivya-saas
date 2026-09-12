// Monta um exemplo de açaiteria na loja padrão: 1 categoria, 1 produto e os
// 4 grupos de opções (tamanho, frutas, complementos, calda), já ligados ao
// produto. Roda uma vez e imprime o que criou. Apagar depois é só rodar o
// mesmo arquivo com --limpar.
const fs = require("fs");

const env = fs.readFileSync(".env", "utf8");
const get = (k) => {
  const line = env.split("\n").find((l) => l.startsWith(k + "="));
  return line
    ? line
        .slice(k.length + 1)
        .replace(/[\r"]/g, "")
        .trim()
    : null;
};

const URL = get("VITE_SUPABASE_URL");
const KEY = get("VITE_SUPABASE_PUBLISHABLE_KEY");
const STORE = "00000000-0000-0000-0000-000000000001";
const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has("--dry-run");
const APPLY = ARGS.has("--apply");
const LIMPAR = ARGS.has("--limpar");
const CONFIRM_LIMPAR = ARGS.has("--confirm-limpar");

if (DRY_RUN === APPLY) {
  throw new Error("Escolha exatamente um modo: --dry-run ou --apply.");
}
if (LIMPAR && (!APPLY || !CONFIRM_LIMPAR)) {
  throw new Error("Remoção exige --apply --limpar --confirm-limpar.");
}

let TOKEN = null;

const api = async (path, opts = {}) => {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Prefer: opts.method === "POST" ? "return=representation" : "count=exact",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const GRUPOS = [
  {
    name: "Tamanho",
    is_required: true,
    min_quantity: 1,
    max_quantity: 1,
    itens: [
      ["300ml", 0],
      ["500ml", 5],
      ["700ml", 9],
    ],
  },
  {
    name: "Frutas (grátis)",
    is_required: false,
    min_quantity: 0,
    max_quantity: 3,
    itens: [
      ["Banana", 0],
      ["Morango", 0],
      ["Kiwi", 0],
      ["Manga", 0],
    ],
  },
  {
    name: "Complementos",
    is_required: false,
    min_quantity: 0,
    max_quantity: 5,
    itens: [
      ["Leite em pó", 2],
      ["Granola", 2],
      ["Paçoca", 3],
      ["Bis picado", 4],
      ["Nutella", 5],
    ],
  },
  {
    name: "Calda",
    is_required: true,
    min_quantity: 1,
    max_quantity: 1,
    itens: [
      ["Chocolate", 0],
      ["Morango", 0],
      ["Sem calda", 0],
    ],
  },
];

const main = async () => {
  // Credenciais vêm do .env (que não vai pro Git), nunca escritas aqui.
  const EMAIL = get("SEED_ADMIN_EMAIL");
  const SENHA = get("SEED_ADMIN_PASSWORD");
  if (!EMAIL || !SENHA) {
    throw new Error(
      "Faltam SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env. " + "Use a conta de dono do sistema.",
    );
  }

  const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  }).then((r) => r.json());
  TOKEN = login.access_token;
  if (!TOKEN) throw new Error("login falhou: " + JSON.stringify(login));

  const nomes = GRUPOS.map((g) => g.name);

  if (DRY_RUN) {
    const [categories, products, groups] = await Promise.all([
      api(`categories?select=id,name&store_id=eq.${STORE}&name=eq.${encodeURIComponent("Açaí")}`),
      api(`products?select=id,name&store_id=eq.${STORE}&name=eq.${encodeURIComponent("Açaí")}`),
      api(
        `addon_groups?select=id,name&store_id=eq.${STORE}&name=in.${encodeURIComponent(`(${nomes.map((n) => `"${n}"`).join(",")})`)}`,
      ),
    ]);
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          wouldCreate: {
            category: categories.length === 0,
            product: products.length === 0,
            addonGroups: nomes.filter((name) => !groups.some((group) => group.name === name)),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  if (LIMPAR) {
    const lista = encodeURIComponent(`(${nomes.map((n) => `"${n}"`).join(",")})`);
    await api(`products?store_id=eq.${STORE}&name=eq.${encodeURIComponent("Açaí")}`, {
      method: "DELETE",
    });
    await api(`addon_groups?store_id=eq.${STORE}&name=in.${lista}`, { method: "DELETE" });
    await api(`categories?store_id=eq.${STORE}&name=eq.${encodeURIComponent("Açaí")}`, {
      method: "DELETE",
    });
    console.log("Exemplo do açaí removido.");
    return;
  }

  // Categoria
  let [cat] = await api(
    `categories?select=id&store_id=eq.${STORE}&name=eq.${encodeURIComponent("Açaí")}`,
  );
  if (!cat) {
    [cat] = await api("categories", {
      method: "POST",
      body: JSON.stringify({ name: "Açaí", store_id: STORE }),
    });
    console.log("categoria criada: Açaí");
  } else {
    console.log("categoria já existia: Açaí");
  }

  // Produto
  let [prod] = await api(
    `products?select=id&store_id=eq.${STORE}&name=eq.${encodeURIComponent("Açaí")}`,
  );
  if (!prod) {
    [prod] = await api("products", {
      method: "POST",
      body: JSON.stringify({
        name: "Açaí",
        description: "Açaí batido na hora. Escolha o tamanho, as frutas e os complementos.",
        price: 12,
        category_id: cat.id,
        store_id: STORE,
        is_available: true,
      }),
    });
    console.log("produto criado: Açaí — base R$ 12,00");
  } else {
    console.log("produto já existia: Açaí");
  }

  // Grupos + itens + vínculo
  for (const g of GRUPOS) {
    let [grupo] = await api(
      `addon_groups?select=id&store_id=eq.${STORE}&name=eq.${encodeURIComponent(g.name)}`,
    );
    if (!grupo) {
      [grupo] = await api("addon_groups", {
        method: "POST",
        body: JSON.stringify({
          name: g.name,
          store_id: STORE,
          is_required: g.is_required,
          min_quantity: g.min_quantity,
          max_quantity: g.max_quantity,
          status: "active",
        }),
      });
    }

    const existentes = await api(`addons?select=name&group_id=eq.${grupo.id}`);
    const jaTem = new Set(existentes.map((a) => a.name));
    const novos = g.itens
      .filter(([nome]) => !jaTem.has(nome))
      .map(([nome, preco]) => ({
        name: nome,
        price: preco,
        group_id: grupo.id,
        store_id: STORE,
        status: "active",
      }));
    if (novos.length) await api("addons", { method: "POST", body: JSON.stringify(novos) });

    const vinculo = await api(
      `product_addon_groups?select=group_id&product_id=eq.${prod.id}&group_id=eq.${grupo.id}`,
    );
    if (!vinculo.length) {
      await api("product_addon_groups", {
        method: "POST",
        body: JSON.stringify({ product_id: prod.id, group_id: grupo.id, store_id: STORE }),
      });
    }

    const regra = g.is_required
      ? `obrigatório, escolha ${g.min_quantity}`
      : `opcional, até ${g.max_quantity}`;
    console.log(`grupo: ${g.name} (${regra}) — ${g.itens.length} opções`);
  }

  console.log("\nPronto. Abra o cardápio e clique no Açaí.");
};

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
