import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FlaskConical, X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Criar disparo</h2>
            <p className="text-sm text-gray-500">
              {participantIds.length} participante(s) selecionado(s)
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* 1. Template */}
          <section>
            <label className="block text-sm font-medium text-gray-700">1. Template aprovado</label>
            {templates !== undefined && approvedTemplates.length === 0 ? (
              <div className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                Nenhum template aprovado. Vá em <strong>Templates HSM</strong> e clique em
                "Sincronizar do Twilio" — só templates com aprovação do WhatsApp podem ser
                disparados.
              </div>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-2 block w-full rounded-md border border-gray-300 p-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
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
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                {preview.body}
              </pre>
            )}
          </section>

          {/* 2. Mapping */}
          {selectedTemplate && mappings.length > 0 && (
            <section>
              <label className="block text-sm font-medium text-gray-700">
                2. De onde vem cada variável
              </label>
              <div className="mt-2 space-y-2">
                {mappings.map((mapping, index) => (
                  <div
                    key={mapping.templateVariable}
                    className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-3"
                  >
                    <div className="flex items-center">
                      <code className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                        {`{{${mapping.templateVariable}}}`}
                      </code>
                      {missingRequired.has(mapping.templateVariable) && (
                        <AlertTriangle className="ml-2 h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <select
                      value={mapping.participantField ?? ''}
                      onChange={(e) =>
                        updateMapping(index, { participantField: e.target.value || undefined })
                      }
                      className="rounded-md border border-gray-300 p-1.5 text-sm"
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
                      className="rounded-md border border-gray-300 p-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
              {missingRequired.size > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
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
              <label className="block text-sm font-medium text-gray-700">
                3. Como cada pessoa vai receber
              </label>
              <div className="mt-2 space-y-3">
                {preview.rows.map((row) => (
                  <div key={row.participantId} className="rounded-md border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-500">
                      {row.name ?? 'Sem nome'} · {row.phone.replace('whatsapp:', '')}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-900">
                      {row.renderedBody}
                    </p>
                    <code className="mt-2 block rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                      ContentVariables: {JSON.stringify(row.contentVariables)}
                    </code>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. Confirm */}
          {selectedTemplate && (
            <section className="space-y-4 border-t border-gray-200 pt-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome do disparo</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
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
                <p className="text-xs text-gray-500">
                  ~{Math.ceil(participantIds.length / ratePerSecond / 60)} min para{' '}
                  {participantIds.length} pessoas. Ritmos altos aumentam o risco do WhatsApp
                  rebaixar a qualidade do número.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-md bg-amber-50 p-3">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => {
                    setDryRun(e.target.checked);
                    setTyped('');
                  }}
                  className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-amber-900">
                    <FlaskConical className="h-4 w-4" />
                    Simulação (dry-run)
                  </span>
                  <span className="text-amber-800">
                    Executa todo o processo e registra o resultado, mas <strong>não envia</strong>{' '}
                    nada pelo WhatsApp. Use para conferir o texto e as variáveis.
                  </span>
                </span>
              </label>

              {needsTypedConfirmation && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-900">
                    Você está prestes a enviar de verdade para{' '}
                    <strong>{participantIds.length} pessoas</strong>. Digite{' '}
                    <code className="font-bold">{TYPED_CONFIRMATION}</code> para confirmar.
                  </p>
                  <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="mt-2 block w-full rounded-md border border-red-300 p-2 text-sm"
                    placeholder={TYPED_CONFIRMATION}
                  />
                </div>
              )}
            </section>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Criando...'
              : dryRun
                ? 'Simular disparo'
                : `Enviar para ${participantIds.length}`}
          </button>
        </div>
      </div>
    </div>
  );
};
