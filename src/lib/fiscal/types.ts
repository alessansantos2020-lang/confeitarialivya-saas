export type FiscalDocumentType = "nfce";

export type FiscalEnvironment = "homologation" | "production";

export type FiscalDocumentStatus =
  "pending" | "processing" | "authorized" | "rejected" | "canceled" | "error";

export type FiscalOperation = "issue" | "query" | "cancel";

export type FiscalSettings = {
  storeId: string;
  documentType: FiscalDocumentType;
  cnpj: string | null;
  legalName: string | null;
  tradeName: string | null;
  stateRegistration: string | null;
  taxRegime: string | null;
  series: string;
  environment: FiscalEnvironment;
  provider: string | null;
};

export type FiscalIssueRequest = {
  storeId: string;
  orderId: string;
  idempotencyKey: string;
  totalAmount: number;
};

export type FiscalProviderResult = {
  status: Exclude<FiscalDocumentStatus, "pending" | "processing">;
  providerDocumentId: string | null;
  accessKey: string | null;
  rejectionReason: string | null;
};

export type FiscalProvider = {
  issue(request: FiscalIssueRequest): Promise<FiscalProviderResult>;
  query(providerDocumentId: string): Promise<FiscalProviderResult>;
  cancel(providerDocumentId: string, reason: string): Promise<FiscalProviderResult>;
};
