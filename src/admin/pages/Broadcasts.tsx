import React from 'react';
import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { Megaphone, FlaskConical } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { BroadcastProgressBar } from '../components/BroadcastProgressBar';

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'neutral',
  enqueueing: 'info',
  running: 'info',
  paused: 'warning',
  completed: 'success',
  cancelled: 'neutral',
  failed: 'danger',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  enqueueing: 'Preparando',
  running: 'Enviando',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  failed: 'Falhou',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <StatusBadge tone={STATUS_TONES[status] ?? 'neutral'} dot>
    {STATUS_LABELS[status] ?? status}
  </StatusBadge>
);

export const Broadcasts: React.FC = () => {
  const broadcasts = useQuery(api.functions.broadcasts.listBroadcasts, {});

  return (
    <div className="p-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-foreground">Disparos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Envio proativo de templates aprovados para listas de participantes.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button asChild>
            <Link to="/participants">
              <Megaphone className="h-4 w-4 mr-2" />
              Novo disparo
            </Link>
          </Button>
        </div>
      </div>

      {broadcasts === undefined ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando...</p>
      ) : broadcasts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Nenhum disparo ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione participantes na página{' '}
            <Link to="/participants" className="text-primary hover:underline">
              Participantes
            </Link>{' '}
            e clique em "Criar disparo".
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Disparo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Progresso</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {broadcasts.map((broadcast) => {
                const done = broadcast.sentCount + broadcast.failedCount + broadcast.skippedCount;
                return (
                  <tr key={broadcast._id} className="hover:bg-muted">
                    <td className="px-6 py-4">
                      <Link
                        to={`/broadcasts/${broadcast._id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {broadcast.label}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{broadcast.templateName}</span>
                        {broadcast.dryRun && (
                          <StatusBadge tone="warning" icon={FlaskConical}>
                            simulação
                          </StatusBadge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={broadcast.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">
                        {done} / {broadcast.total}
                      </div>
                      <BroadcastProgressBar
                        sent={broadcast.sentCount}
                        failed={broadcast.failedCount}
                        skipped={broadcast.skippedCount}
                        total={broadcast.total}
                        className="mt-1 h-1.5 w-32"
                        aria-label={`Progresso do disparo ${broadcast.label}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(broadcast.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
