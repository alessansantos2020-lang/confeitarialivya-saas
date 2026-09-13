export type SelectedAddonPreview = {
  id?: string;
  name?: string;
  price?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const parseSelectedAddons = (value: unknown): SelectedAddonPreview[] => {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item): SelectedAddonPreview[] => {
    if (!isRecord(item)) return [];
    const id = typeof item["id"] === "string" ? item["id"] : undefined;
    const name = typeof item["name"] === "string" ? item["name"] : undefined;
    if (!id && !name) return [];

    return [
      {
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(typeof item["price"] === "number" ? { price: item["price"] } : {}),
      },
    ];
  });
};

export const sortAddons = (addons: readonly SelectedAddonPreview[]): SelectedAddonPreview[] =>
  [...addons].sort((a, b) => (a.id || a.name || "").localeCompare(b.id || b.name || ""));

export const cartItemIdentityKey = (
  productId: string,
  addons: readonly SelectedAddonPreview[],
  observation?: string | null,
): string =>
  JSON.stringify({
    productId,
    addons: sortAddons(addons),
    observation: observation ?? "",
  });

export const orderItemsSummary = (
  items: readonly {
    quantity: number;
    product_name?: string | null;
    product?: { name?: string | null } | null;
    selected_addons?: unknown;
  }[],
): string =>
  items
    .map((item) => {
      const name = item.product_name || item.product?.name || "Produto";
      const addons = parseSelectedAddons(item.selected_addons)
        .map((addon) => addon.name)
        .filter((name): name is string => Boolean(name))
        .join(", ");
      return `${item.quantity}x ${name}${addons ? ` (${addons})` : ""}`;
    })
    .join("\n");
