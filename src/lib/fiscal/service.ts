import type { FiscalIssueRequest, FiscalProvider, FiscalProviderResult } from "./types";

export type FiscalService = FiscalProvider;

/**
 * Adapter local sem emissão. Provedor real entra somente em ambiente server-side.
 */
export class MockFiscalProvider implements FiscalService {
  async issue(_request: FiscalIssueRequest): Promise<FiscalProviderResult> {
    return {
      status: "error",
      providerDocumentId: null,
      accessKey: null,
      rejectionReason: "Provedor fiscal não configurado.",
    };
  }

  async query(_providerDocumentId: string): Promise<FiscalProviderResult> {
    return {
      status: "error",
      providerDocumentId: null,
      accessKey: null,
      rejectionReason: "Provedor fiscal não configurado.",
    };
  }

  async cancel(_providerDocumentId: string, _reason: string): Promise<FiscalProviderResult> {
    return {
      status: "error",
      providerDocumentId: null,
      accessKey: null,
      rejectionReason: "Provedor fiscal não configurado.",
    };
  }
}

export const fiscalService: FiscalService = new MockFiscalProvider();
