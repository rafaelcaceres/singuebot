import React, { useState } from 'react';

interface ParticipantDetailsProps {
  participant: {
    name?: string;
    phone: string;
    consent: boolean;
    cargo?: string;
    empresa?: string;
    setor?: string;
    tags: string[];
  };
  cluster: { id: string; name: string } | null;
  session: { step: string; startedAt: number } | null;
  profile: any;
  stats: {
    totalConversations: number;
    totalMessages: number;
    lastActivity?: number;
  };
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex justify-between py-1.5">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm text-gray-900 text-right">{value || '-'}</span>
  </div>
);

export const ParticipantDetails: React.FC<ParticipantDetailsProps> = ({
  participant,
  cluster,
  session,
  profile,
  stats,
}) => {
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stageLabels: Record<string, string> = {
    not_started: 'Não iniciado',
    termos_aceite: 'Termos & Confirmação',
    mapeamento_carreira: 'Mapeamento de Carreira',
    momento_carreira: 'Momento de Carreira',
    expectativas_evento: 'Expectativas do Evento',
    objetivo_principal: 'Objetivo Principal',
    finalizacao: 'Finalização',
    intro: 'Introdução',
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Detalhes do Participante</h3>
      </div>

      {/* Personal Data */}
      <CollapsibleSection title="Dados Pessoais" defaultOpen>
        <DetailRow label="Nome" value={participant.name} />
        <DetailRow label="Telefone" value={participant.phone} />
        <DetailRow
          label="Consentimento LGPD"
          value={
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                participant.consent
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {participant.consent ? 'Sim' : 'Não'}
            </span>
          }
        />
        <DetailRow label="Cargo" value={participant.cargo} />
        <DetailRow label="Empresa" value={participant.empresa} />
        <DetailRow label="Setor" value={participant.setor} />
        <DetailRow
          label="Cluster"
          value={
            cluster ? (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {cluster.name}
              </span>
            ) : (
              '-'
            )
          }
        />
        {participant.tags.length > 0 && (
          <div className="mt-2">
            <span className="text-sm text-gray-500">Tags:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {participant.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* History */}
      <CollapsibleSection title="Histórico" defaultOpen>
        <DetailRow
          label="Total de conversas"
          value={stats.totalConversations}
        />
        <DetailRow label="Total de mensagens" value={stats.totalMessages} />
        <DetailRow label="Última atividade" value={formatDate(stats.lastActivity)} />
        <DetailRow
          label="Estágio atual"
          value={
            session ? (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                {stageLabels[session.step] || session.step}
              </span>
            ) : (
              'Não iniciado'
            )
          }
        />
      </CollapsibleSection>

      {/* Profile (if exists) */}
      {profile && (
        <CollapsibleSection title="Perfil">
          {profile.realizacoes && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Realizações
              </span>
              <p className="text-sm text-gray-900 mt-1">{profile.realizacoes}</p>
            </div>
          )}
          {profile.visaoFuturo && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Visão de Futuro
              </span>
              <p className="text-sm text-gray-900 mt-1">{profile.visaoFuturo}</p>
            </div>
          )}
          {profile.desafiosAtuais && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Desafios Atuais
              </span>
              <p className="text-sm text-gray-900 mt-1">{profile.desafiosAtuais}</p>
            </div>
          )}
          {profile.motivacao && (
            <div className="mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">
                Motivação
              </span>
              <p className="text-sm text-gray-900 mt-1">{profile.motivacao}</p>
            </div>
          )}
        </CollapsibleSection>
      )}
    </div>
  );
};
