import React from 'react';
import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { Megaphone, FlaskConical } from 'lucide-react';
import { api } from '../../../convex/_generated/api';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  enqueueing: 'bg-blue-100 text-blue-800',
  running: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-700',
  failed: 'bg-red-100 text-red-800',
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
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {STATUS_LABELS[status] ?? status}
  </span>
);

export const Broadcasts: React.FC = () => {
  const broadcasts = useQuery(api.functions.broadcasts.listBroadcasts, {});

  return (
    <div className="p-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Disparos</h1>
          <p className="mt-2 text-sm text-gray-700">
            Envio proativo de templates aprovados para listas de participantes.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/participants"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
          >
            <Megaphone className="h-4 w-4 mr-2" />
            Novo disparo
          </Link>
        </div>
      </div>

      {broadcasts === undefined ? (
        <p className="mt-8 text-sm text-gray-500">Carregando...</p>
      ) : broadcasts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-900">Nenhum disparo ainda</p>
          <p className="mt-1 text-sm text-gray-500">
            Selecione participantes na página{' '}
            <Link to="/participants" className="text-purple-600 hover:underline">
              Participantes
            </Link>{' '}
            e clique em "Criar disparo".
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Disparo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Progresso</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {broadcasts.map((broadcast) => {
                const done = broadcast.sentCount + broadcast.failedCount + broadcast.skippedCount;
                const percent = broadcast.total > 0 ? Math.round((done / broadcast.total) * 100) : 0;
                return (
                  <tr key={broadcast._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/broadcasts/${broadcast._id}`}
                        className="font-medium text-gray-900 hover:text-purple-600"
                      >
                        {broadcast.label}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span>{broadcast.templateName}</span>
                        {broadcast.dryRun && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                            <FlaskConical className="h-3 w-3" />
                            simulação
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={broadcast.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {done} / {broadcast.total}
                      </div>
                      <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-purple-600 transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
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
