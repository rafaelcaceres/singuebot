import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BroadcastComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantIds: Id<'participants'>[];
}

interface MappingInput {
  templateVariable: string;
  participantField?: string;
  defaultValue?: string;
  isRequired: boolean;
}

const TYPED_CONFIRMATION = 'ENVIAR';
const CONFIRMATION_THRESHOLD = 200;

export const BroadcastComposer: React.FC<BroadcastComposerProps> = ({
  open,
  onOpenChange,
  participantIds,
}) => {
  const navigate = useNavigate();

  const [templateId, setTemplateId] = useState<string>('');
  const [mappings, setMappings] = useState<MappingInput[]>([]);
  const [label, setLabel] = useState('');
  const [ratePerSecond, setRatePerSecond] = useState(5);
  const [dryRun, setDryRun] = useState(true); // Safe by default
  const [typed, setTyped] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery(api.admin.getTemplates);
  const participantFields = useQuery(api.functions.templateConfig.getParticipantFields, {});
  const createBroadcast = useMutation(api.functions.broadcasts.createBroadcast);

  const approvedTemplates = useMemo(
    () => (templates ?? []).filter((t: any) => t.approvalStatus === 'approved'),
    [templates],
  );
  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t: any) => t._id === templateId),
    [approvedTemplates, templateId],
  );

  // Seed one mapping row per template variable when the template changes.
  useEffect(() => {
    if (!selectedTemplate) {
      setMappings([]);
      return;
    }
    const configured = (selectedTemplate as any).variableMappings as
      | Array<{ templateVariable: string; participantField?: string; defaultValue?: string; isRequired: boolean }>
      | undefined;

    setMappings(
      (selectedTemplate.variables ?? []).map((variable: string) => {
        const existing = configured?.find((m) => m.templateVariable === variable);
        return {
          templateVariable: variable,
          participantField: existing?.participantField ?? 'name',
          defaultValue: existing?.defaultValue,
          isRequired: existing?.isRequired ?? true,
        };
      }),
    );
    setLabel(selectedTemplate.name);
  }, [selectedTemplate]);

  // The preview is the point of this screen: it shows the literal ContentVariables
  // that will reach Twilio, for real recipients, before anything is sent.
  const preview = useQuery(
    api.functions.broadcasts.previewBroadcast,
    selectedTemplate
      ? {
          templateId: selectedTemplate._id,
          participantIds: participantIds.slice(0, 3),
          mappings,
        }
      : 'skip',
  );

  const missingRequired = useMemo(
    () => new Set(preview?.rows.flatMap((row) => row.missingRequired) ?? []),
    [preview],
  );

  const needsTypedConfirmation = !dryRun && participantIds.length >= CONFIRMATION_THRESHOLD;
  const canSubmit =
    !!selectedTemplate &&
    participantIds.length > 0 &&
    !isSubmitting &&
    (!needsTypedConfirmation || typed.trim().toUpperCase() === TYPED_CONFIRMATION);

  const handleClose = () => {
    setTemplateId('');
    setMappings([]);
    setTyped('');
    setError(null);
    setDryRun(true);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const broadcastId = await createBroadcast({
        templateId: selectedTemplate._id,
        label: label.trim() || undefined,
        selection: { mode: 'ids', participantIds },
        mappings,
        ratePerSecond,
        dryRun,
      });
      handleClose();
      void navigate(`/broadcasts/${broadcastId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar disparo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMapping = (index: number, patch: Partial<MappingInput>) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar disparo</DialogTitle>
          <DialogDescription>
            {participantIds.length} participante(s) selecionado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 1. Template */}
          <section>
            <label className="block text-sm font-medium text-foreground">1. Template aprovado</label>
            {templates !== undefined && approvedTemplates.length === 0 ? (
              <div className="mt-2 rounded-md border border-border bg-warning-muted p-3 text-sm text-warning-muted-foreground">
                Nenhum template aprovado. Vá em <strong>Templates HSM</strong> e clique em
                "Sincronizar do Twilio" — só templates com aprovação do WhatsApp podem ser
                disparados.
              </div>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-2 block w-full rounded-md border border-input bg-background p-2 focus:border-ring focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecione um template...</option>
                {approvedTemplates.map((template: any) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.locale})
                  </option>
                ))}
              </select>
            )}

            {preview?.body && (
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {preview.body}
              </pre>
            )}
          </section>

          {/* 2. Mapping */}
          {selectedTemplate && mappings.length > 0 && (
            <section>
              <label className="block text-sm font-medium text-foreground">
                2. De onde vem cada variável
              </label>
              <div className="mt-2 space-y-2">
                {mappings.map((mapping, index) => (
                  <div
                    key={mapping.templateVariable}
                    className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-3"
                  >
                    <div className="flex items-center">
                      <code className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {`{{${mapping.templateVariable}}}`}
                      </code>
                      {missingRequired.has(mapping.templateVariable) && (
                        <AlertTriangle
                          className="ml-2 h-4 w-4 text-warning"
                          aria-label="Variável obrigatória sem valor"
                        />
                      )}
                    </div>
                    <select
                      value={mapping.participantField ?? ''}
                      onChange={(e) =>
                        updateMapping(index, { participantField: e.target.value || undefined })
                      }
                      className="rounded-md border border-input bg-background p-1.5 text-sm"
                    >
                      <option value="">— valor fixo —</option>
                      {(participantFields ?? []).map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={mapping.defaultValue ?? ''}
                      onChange={(e) =>
                        updateMapping(index, { defaultValue: e.target.value || undefined })
                      }
                      placeholder={mapping.participantField ? 'Se estiver vazio...' : 'Valor fixo'}
                      className="rounded-md border border-input bg-background p-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
              {missingRequired.size > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  Algumas variáveis ficam vazias para os participantes abaixo. Defina um valor
                  padrão, ou a mensagem chegará com um espaço em branco.
                </p>
              )}
            </section>
          )}

          {/* 3. Preview — the regression guard for the ContentVariables mapping */}
          {preview && preview.rows.length > 0 && (
            <section>
              <label className="block text-sm font-medium text-foreground">
                3. Como cada pessoa vai receber
              </label>
              <div className="mt-2 space-y-3">
                {preview.rows.map((row) => (
                  <div key={row.participantId} className="rounded-md border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {row.name ?? 'Sem nome'} · {row.phone.replace('whatsapp:', '')}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                      {row.renderedBody}
                    </p>
                    <code className="mt-2 block rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      ContentVariables: {JSON.stringify(row.contentVariables)}
                    </code>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. Confirm */}
          {selectedTemplate && (
            <section className="space-y-4 border-t border-border pt-5">
              <div>
                <label className="block text-sm font-medium text-foreground">Nome do disparo</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Ritmo: {ratePerSecond} mensagens por segundo
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={ratePerSecond}
                  onChange={(e) => setRatePerSecond(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <p className="text-xs text-muted-foreground">
                  ~{Math.ceil(participantIds.length / ratePerSecond / 60)} min para{' '}
                  {participantIds.length} pessoas. Ritmos altos aumentam o risco do WhatsApp
                  rebaixar a qualidade do número.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-md border border-border bg-warning-muted p-3 text-warning-muted-foreground">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => {
                    setDryRun(e.target.checked);
                    setTyped('');
                  }}
                  className="mt-0.5 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <FlaskConical className="h-4 w-4" />
                    Simulação (dry-run)
                  </span>
                  <span>
                    Executa todo o processo e registra o resultado, mas <strong>não envia</strong>{' '}
                    nada pelo WhatsApp. Use para conferir o texto e as variáveis.
                  </span>
                </span>
              </label>

              {needsTypedConfirmation && (
                <div className="rounded-md border border-border bg-destructive-muted p-3">
                  <p className="flex items-start gap-1.5 text-sm text-destructive-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>
                      Você está prestes a enviar de verdade para{' '}
                      <strong>{participantIds.length} pessoas</strong>. Digite{' '}
                      <code className="font-bold">{TYPED_CONFIRMATION}</code> para confirmar.
                    </span>
                  </p>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    aria-label={`Digite ${TYPED_CONFIRMATION} para confirmar o envio`}
                    className="mt-2 block w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={TYPED_CONFIRMATION}
                  />
                </div>
              )}
            </section>
          )}

          {error && (
            <div className="rounded-md bg-destructive-muted p-3 text-sm text-destructive-muted-foreground">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting
              ? 'Criando...'
              : dryRun
                ? 'Simular disparo'
                : `Enviar para ${participantIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
