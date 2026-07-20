import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, X, RotateCcw, FlaskConical } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { StatusPill } from './Broadcasts';

const SKIP_LABELS: Record<string, string> = {
  invalid_phone: 'Telefone inválido',
  duplicate_phone: 'Telefone duplicado na seleção',
  not_in_allowlist: 'Fora da lista de teste',
};

export const BroadcastDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const broadcastId = id as Id<'broadcasts'>;
  const [actionError, setActionError] = useState<string | null>(null);

  // Progress is a single O(1) read of denormalized counters on the broadcast doc.
  // Convex pushes updates, so this keeps ticking with the tab in the background and
  // is correct again on reload — the send does not live in the browser.
  const broadcast = useQuery(api.functions.broadcasts.getBroadcast, { broadcastId });
  const failures = useQuery(api.functions.broadcasts.getFailureSummary, { broadcastId });

  const pause = useMutation(api.functions.broadcasts.pauseBroadcast);
  const resume = useMutation(api.functions.broadcasts.resumeBroadcast);
  const cancel = useMutation(api.functions.broadcasts.cancelBroadcast);
  const retry = useMutation(api.functions.broadcasts.retryFailed);

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  if (broadcast === undefined) return <div className="p-8 text-sm text-gray-500">Carregando...</div>;
  if (broadcast === null) return <div className="p-8 text-sm text-gray-500">Disparo não encontrado.</div>;

  const done = broadcast.sentCount + broadcast.failedCount + broadcast.skippedCount;
  const percent = broadcast.total > 0 ? Math.round((done / broadcast.total) * 100) : 0;
  const isActive = broadcast.status === 'running' || broadcast.status === 'enqueueing';

  return (
    <div className="p-8">
      <Link to="/broadcasts" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Disparos
      </Link>

      <div className="mt-4 sm:flex sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{broadcast.label}</h1>
            <StatusPill status={broadcast.status} />
            {broadcast.dryRun && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <FlaskConical className="h-3 w-3" />
                simulação — nada foi enviado
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Template <span className="font-medium">{broadcast.templateName}</span>
            {broadcast.createdByEmail && ` · criado por ${broadcast.createdByEmail}`}
          </p>
        </div>

        <div className="mt-4 flex gap-2 sm:mt-0">
          {broadcast.status === 'running' && (
            <button
              onClick={() => void run(() => pause({ broadcastId }))}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pause className="mr-1.5 h-4 w-4" />
              Pausar
            </button>
          )}
          {broadcast.status === 'paused' && (
            <button
              onClick={() => void run(() => resume({ broadcastId }))}
              className="inline-flex items-center rounded-md border border-transparent bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Play className="mr-1.5 h-4 w-4" />
              Retomar
            </button>
          )}
          {isActive || broadcast.status === 'paused' ? (
            <button
              onClick={() => void run(() => cancel({ broadcastId }))}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <X className="mr-1.5 h-4 w-4" />
              Cancelar
            </button>
          ) : null}
          {broadcast.failedCount > 0 && !isActive && (
            <button
              onClick={() => void run(() => retry({ broadcastId }))}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reenviar falhas
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{actionError}</div>
      )}

      {/* Progress */}
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700">
            {done} de {broadcast.total}
          </span>
          <span className="text-sm text-gray-500">{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-purple-600 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Enviados</dt>
            <dd className="mt-1 text-2xl font-semibold text-green-600">{broadcast.sentCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Falhas</dt>
            <dd className="mt-1 text-2xl font-semibold text-red-600">{broadcast.failedCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Pulados</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-500">{broadcast.skippedCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Ritmo</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900">
              {broadcast.ratePerSecond}
              <span className="ml-1 text-sm font-normal text-gray-500">msg/s</span>
            </dd>
          </div>
        </dl>

        {broadcast.startedAt && broadcast.completedAt && (
          <p className="mt-4 text-xs text-gray-500">
            Duração: {Math.round((broadcast.completedAt - broadcast.startedAt) / 1000)}s
          </p>
        )}
      </div>

      {/* Failures, grouped by Twilio error code rather than one row per recipient */}
      {failures && failures.length > 0 && (
        <div className="mt-6 rounded-lg border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-200 bg-red-50 px-6 py-3">
            <h2 className="text-sm font-medium text-red-900">Falhas por motivo</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {failures.map((failure, index) => (
              <li key={index} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm text-gray-900">{failure.errorMessage}</p>
                  {failure.errorCode !== undefined && (
                    <p className="text-xs text-gray-500">Código Twilio: {failure.errorCode}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{failure.count}</span>
                  {failure.errorCode !== undefined && !isActive && (
                    <button
                      onClick={() =>
                        void run(() => retry({ broadcastId, errorCode: failure.errorCode }))
                      }
                      className="text-xs text-purple-600 hover:underline"
                    >
                      reenviar estes
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {broadcast.skippedCount > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          Pulados não são enviados: {Object.values(SKIP_LABELS).join(' · ')}.
        </p>
      )}
    </div>
  );
};
