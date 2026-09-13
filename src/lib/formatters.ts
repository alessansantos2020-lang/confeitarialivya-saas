const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatCurrencyBRL = (value: number | null | undefined): string => {
  const numericValue = Number(value);
  return brlFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
};

export const normalizePhone = (value: string | null | undefined): string =>
  (value ?? "").replace(/\D/g, "");

export const isValidDate = (value: string | number | Date): boolean => {
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
};
