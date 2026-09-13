export const getErrorMessage = (error: unknown, fallback = "Ocorreu um erro."): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
};

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";
