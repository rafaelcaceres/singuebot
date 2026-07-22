import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, X, RotateCcw, FlaskConical } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { StatusPill } from './Broadcasts';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';

const SKIP_LABELS: Record<string, string> = {
  invalid_phone: 'Telefone inválido',
  duplicate_phone: 'Telefone duplicado na seleção',
  not_in_allowlist: 'Fora da lista de teste (TWILIO_TEST_ALLOWLIST)',
  unknown: 'Motivo não registrado',
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
  const skipped = useQuery(api.functions.broadcasts.getSkippedSummary, { broadcastId });

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

  if (broadcast === undefined) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  if (broadcast === null) return <div className="p-8 text-sm text-muted-foreground">Disparo não encontrado.</div>;

  const done = broadcast.sentCount + broadcast.failedCount + broadcast.skippedCount;
  const percent = broadcast.total > 0 ? Math.round((done / broadcast.total) * 100) : 0;
  const isActive = broadcast.status === 'running' || broadcast.status === 'enqueueing';

  return (
    <div className="p-8">
      <Link to="/broadcasts" className="inline-flex items-center rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Disparos
      </Link>

      <div className="mt-4 sm:flex sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{broadcast.label}</h1>
            <StatusPill status={broadcast.status} />
            {broadcast.dryRun && (
              <StatusBadge tone="warning" icon={FlaskConical}>
                simulação — nada foi enviado
              </StatusBadge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Template <span className="font-medium">{broadcast.templateName}</span>
            {broadcast.createdByEmail && ` · criado por ${broadcast.createdByEmail}`}
          </p>
        </div>

        <div className="mt-4 flex gap-2 sm:mt-0">
          {broadcast.status === 'running' && (
            <Button variant="outline" onClick={() => void run(() => pause({ broadcastId }))}>
              <Pause className="mr-1.5 h-4 w-4" />
              Pausar
            </Button>
          )}
          {broadcast.status === 'paused' && (
            <Button onClick={() => void run(() => resume({ broadcastId }))}>
              <Play className="mr-1.5 h-4 w-4" />
              Retomar
            </Button>
          )}
          {isActive || broadcast.status === 'paused' ? (
            <Button variant="outline" onClick={() => void run(() => cancel({ broadcastId }))}>
              <X className="mr-1.5 h-4 w-4" />
              Cancelar
            </Button>
          ) : null}
          {broadcast.failedCount > 0 && !isActive && (
            <Button variant="outline" onClick={() => void run(() => retry({ broadcastId }))}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reenviar falhas
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-border bg-destructive-muted p-4 text-sm text-destructive-muted-foreground"
        >
          {actionError}
        </div>
      )}

      {/* Progress */}
      <div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground">
            {done} de {broadcast.total}
          </span>
          <span className="text-sm text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="mt-2" aria-label="Progresso do disparo" />

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Enviados</dt>
            <dd className="mt-1 text-2xl font-semibold text-success">{broadcast.sentCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</dt>
            <dd className="mt-1 text-2xl font-semibold text-destructive">{broadcast.failedCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pulados</dt>
            <dd className="mt-1 text-2xl font-semibold text-muted-foreground">{broadcast.skippedCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ritmo</dt>
            <dd className="mt-1 text-2xl font-semibold text-foreground">
              {broadcast.ratePerSecond}
              <span className="ml-1 text-sm font-normal text-muted-foreground">msg/s</span>
            </dd>
          </div>
        </dl>

        {broadcast.startedAt && broadcast.completedAt && (
          <p className="mt-4 text-xs text-muted-foreground">
            Duração: {Math.round((broadcast.completedAt - broadcast.startedAt) / 1000)}s
          </p>
        )}
      </div>

      {/* Failures, grouped by Twilio error code rather than one row per recipient */}
      {failures && failures.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-destructive-muted px-6 py-3">
            <h2 className="text-sm font-medium text-destructive-muted-foreground">Falhas por motivo</h2>
          </div>
          <ul className="divide-y divide-border">
            {failures.map((failure, index) => (
              <li key={index} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm text-foreground">{failure.errorMessage}</p>
                  {failure.errorCode !== undefined && (
                    <p className="text-xs text-muted-foreground">Código Twilio: {failure.errorCode}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{failure.count}</span>
                  {failure.errorCode !== undefined && !isActive && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        void run(() => retry({ broadcastId, errorCode: failure.errorCode }))
                      }
                    >
                      reenviar estes
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skipped, grouped by reason — a skipped number never reached Twilio.
          Shows WHY each number was dropped, plus the numbers, so an operator
          can find a specific one they expected to reach. */}
      {skipped && skipped.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-3">
            <h2 className="text-sm font-medium text-foreground">Pulados por motivo</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Estes números não foram enviados.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {skipped.map((group) => (
              <li key={group.skipReason} className="px-6 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-foreground">
                    {SKIP_LABELS[group.skipReason] ?? group.skipReason}
                  </p>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {group.count}
                  </span>
                </div>
                {group.phones.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                      {group.phones.map((phone) => (
                        <span key={phone}>{phone}</span>
                      ))}
                    </div>
                    {group.count > group.phones.length && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        … e mais {group.count - group.phones.length}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
