import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSaasSettings,
  updateSaasSettings,
  MAINTENANCE_FALLBACK,
  type SaasSettings,
  type SaasSettingsInput,
} from '@/lib/saas-settings.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { toast } from 'sonner'
import { Loader2, Save, Layout, Palette, Wrench, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/super/configuracoes')({
  component: SuperSettingsPage,
})

type FormState = {
  name: string
  logoUrl: string | null
  contactEmail: string
  contactPhone: string
  supportInfo: string
  primaryColor: string
  maintenanceMode: boolean
  maintenanceMessage: string
}

const formFrom = (s: SaasSettings): FormState => ({
  name: s.name,
  logoUrl: s.logo_url,
  contactEmail: s.contact_email ?? '',
  contactPhone: s.contact_phone ?? '',
  supportInfo: s.support_info ?? '',
  primaryColor: s.primary_color,
  maintenanceMode: s.maintenance_mode,
  maintenanceMessage: s.maintenance_message ?? '',
})

const trimmed = (v: string): string | null => (v.trim() ? v.trim() : null)

const FIELD = 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600'
const PANEL = 'bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-5'

function SuperSettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['saas-settings'],
    queryFn: getSaasSettings,
  })

  useEffect(() => {
    if (data) setForm(formFrom(data))
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (input: SaasSettingsInput) => updateSaasSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-settings'] })
      toast.success('Configurações salvas!')
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar.'),
  })

  const save = () => {
    if (!form) return
    if (!form.name.trim()) {
      toast.error('O nome do sistema não pode ficar vazio.')
      return
    }
    saveMutation.mutate({
      name: form.name.trim(),
      logoUrl: form.logoUrl,
      contactEmail: trimmed(form.contactEmail),
      contactPhone: trimmed(form.contactPhone),
      supportInfo: trimmed(form.supportInfo),
      primaryColor: form.primaryColor,
      maintenanceMode: form.maintenanceMode,
      maintenanceMessage: trimmed(form.maintenanceMessage),
    })
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300 text-sm">
        Não foi possível carregar as configurações: {(error as Error).message}
      </div>
    )
  }

  if (isLoading || !form) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações do Sistema</h1>
          <p className="text-slate-400 text-sm">
            Identidade da plataforma e modo manutenção. Só você altera isto.
          </p>
        </div>
        <Button
          className="bg-pink-600 hover:bg-pink-700 min-w-[160px] gap-2"
          disabled={saveMutation.isPending}
          onClick={save}
        >
          {saveMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Salvar alterações
        </Button>
      </div>

      {form.maintenanceMode && data?.maintenance_mode && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-200 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>
            O modo manutenção está <strong>ligado agora</strong>: os painéis das lojas estão
            bloqueados. O cardápio dos clientes continua no ar.
          </p>
        </div>
      )}

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="mb-4 bg-slate-900 border border-slate-800">
          <TabsTrigger value="geral" className="gap-2">
            <Layout className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="gap-2">
            <Palette className="w-4 h-4" />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="sistema" className="gap-2">
            <Wrench className="w-4 h-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="outline-none">
          <div className={PANEL}>
            <div className="space-y-2">
              <Label htmlFor="saas-nome" className="text-slate-300">
                Nome do sistema
              </Label>
              <Input
                id="saas-nome"
                className={FIELD}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Painel do Dono"
              />
              <p className="text-[11px] text-slate-500">
                Aparece no menu deste painel e no botão de acesso dentro do painel das lojas. Não
                muda o nome que o cliente vê no cardápio — esse é de cada loja.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="saas-email" className="text-slate-300">
                  E-mail de contato
                </Label>
                <Input
                  id="saas-email"
                  type="email"
                  className={FIELD}
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="contato@seudominio.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saas-telefone" className="text-slate-300">
                  Telefone
                </Label>
                <Input
                  id="saas-telefone"
                  className={FIELD}
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="(11) 90000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="saas-suporte" className="text-slate-300">
                Suporte
              </Label>
              <Textarea
                id="saas-suporte"
                className={FIELD}
                rows={3}
                value={form.supportInfo}
                onChange={(e) => setForm({ ...form, supportInfo: e.target.value })}
                placeholder="WhatsApp, link de atendimento ou horário em que você responde."
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="aparencia" className="outline-none">
          <div className={PANEL}>
            <div className="space-y-2">
              <Label className="text-slate-300">Logo</Label>
              <div className="max-w-sm">
                <ImageUpload
                  value={form.logoUrl}
                  onChange={(url) => setForm({ ...form, logoUrl: url })}
                  folder="store"
                  maxSizeMB={2}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Substitui o ícone de escudo no alto do menu deste painel.
              </p>
            </div>

            <div className="space-y-2 max-w-sm">
              <Label htmlFor="saas-cor" className="text-slate-300">
                Cor principal
              </Label>
              <div className="flex gap-2">
                <Input
                  id="saas-cor"
                  type="color"
                  className="w-12 h-10 p-1 bg-slate-950 border-slate-800"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                />
                <Input
                  className={FIELD}
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  placeholder="#1d4ed8"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Recolore este painel (botões, menu, destaques). Cada loja continua escolhendo a
                cor dela em Configurações da loja.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sistema" className="outline-none">
          <div className={PANEL}>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div>
                <div className="text-sm font-medium text-slate-100">Modo manutenção</div>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Ligado, o painel das lojas (<span className="font-mono">/admin</span> e{' '}
                  <span className="font-mono">/staff</span>) fica bloqueado com um recado. O
                  cardápio dos clientes continua no ar e recebendo pedidos, e você nunca é
                  bloqueado.
                </p>
              </div>
              <Switch
                checked={form.maintenanceMode}
                onCheckedChange={(checked) => setForm({ ...form, maintenanceMode: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saas-recado" className="text-slate-300">
                Recado da manutenção
              </Label>
              <Textarea
                id="saas-recado"
                className={FIELD}
                rows={3}
                value={form.maintenanceMessage}
                onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
                placeholder={MAINTENANCE_FALLBACK}
              />
              <p className="text-[11px] text-slate-500">
                É o que o dono da loja lê na tela de bloqueio. Vazio, aparece: “
                {MAINTENANCE_FALLBACK}”
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
