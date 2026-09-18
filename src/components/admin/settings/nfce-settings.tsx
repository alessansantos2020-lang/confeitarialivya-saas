import { FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiscalSettingsForm = {
  cnpj: string;
  legal_name: string;
  trade_name: string;
  state_registration: string;
  tax_regime: string;
  series: string;
  environment: "homologation" | "production";
  provider: string;
};

export function NfceSettings({
  fiscalSettings,
  setFiscalSettings,
  isLoading,
  isSaving,
  onSubmit,
}: {
  fiscalSettings: FiscalSettingsForm;
  setFiscalSettings: React.Dispatch<React.SetStateAction<FiscalSettingsForm>>;
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-pink-600" />
          Configuração NFC-e
        </CardTitle>
        <CardDescription>
          Cadastre os dados fiscais básicos da loja para futura integração de emissão.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="animate-spin text-pink-600" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Esta tela apenas salva configuração. Emissão de NFC-e ainda está indisponível porque
              nenhum provedor fiscal foi conectado. Não informe certificado digital, senha, token ou
              chave secreta aqui.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ["fiscal-cnpj", "CNPJ", "cnpj", "00.000.000/0000-00"],
                  ["fiscal-ie", "Inscrição estadual", "state_registration", "Inscrição estadual"],
                  ["fiscal-legal-name", "Razão social", "legal_name", ""],
                  ["fiscal-trade-name", "Nome fantasia", "trade_name", ""],
                  ["fiscal-tax-regime", "Regime tributário", "tax_regime", "Ex.: Simples Nacional"],
                  ["fiscal-series", "Série", "series", ""],
                ] as const
              ).map(([id, label, key, placeholder]) => (
                <div className="space-y-2" key={id}>
                  <Label htmlFor={id}>{label}</Label>
                  <Input
                    id={id}
                    value={fiscalSettings[key]}
                    onChange={(e) =>
                      setFiscalSettings({ ...fiscalSettings, [key]: e.target.value })
                    }
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="fiscal-environment">Ambiente</Label>
                <Select
                  value={fiscalSettings.environment}
                  onValueChange={(value: "homologation" | "production") =>
                    setFiscalSettings({ ...fiscalSettings, environment: value })
                  }
                >
                  <SelectTrigger id="fiscal-environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologation">Homologação (testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscal-provider">Provedor fiscal</Label>
                <Input
                  id="fiscal-provider"
                  value={fiscalSettings.provider}
                  onChange={(e) =>
                    setFiscalSettings({ ...fiscalSettings, provider: e.target.value })
                  }
                  placeholder="Ainda não definido"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving} className="gap-2 w-full sm:w-auto">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar configuração NFC-e
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
