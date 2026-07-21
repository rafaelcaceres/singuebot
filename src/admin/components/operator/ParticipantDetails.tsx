import React, { useState } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { stageLabel, stageTone } from '@/admin/lib/stages';

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
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="font-medium text-foreground">{title}</span>
        <svg
          aria-hidden="true"
          className={`w-5 h-5 text-muted-foreground transition-transform ${
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
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm text-foreground text-right">{value || '-'}</span>
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

  return (
    <div className="w-80 border-l border-border bg-card overflow-y-auto">
      <div className="p-4 border-b border-border bg-muted">
        <h3 className="font-semibold text-foreground">Detalhes do Participante</h3>
      </div>

      {/* Personal Data */}
      <CollapsibleSection title="Dados Pessoais" defaultOpen>
        <DetailRow label="Nome" value={participant.name} />
        <DetailRow label="Telefone" value={participant.phone} />
        <DetailRow
          label="Consentimento LGPD"
          value={
            <StatusBadge tone={participant.consent ? 'success' : 'danger'}>
              {participant.consent ? 'Sim' : 'Não'}
            </StatusBadge>
          }
        />
        <DetailRow label="Cargo" value={participant.cargo} />
        <DetailRow label="Empresa" value={participant.empresa} />
        <DetailRow label="Setor" value={participant.setor} />
        <DetailRow
          label="Cluster"
          value={
            cluster ? (
              <StatusBadge tone="info">{cluster.name}</StatusBadge>
            ) : (
              '-'
            )
          }
        />
        {participant.tags.length > 0 && (
          <div className="mt-2">
            <span className="text-sm text-muted-foreground">Tags:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {participant.tags.map((tag, index) => (
                <StatusBadge key={index} tone="neutral">
                  {tag}
                </StatusBadge>
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
              <StatusBadge tone={stageTone(session.step)}>
                {stageLabel(session.step)}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Não iniciado</StatusBadge>
            )
          }
        />
      </CollapsibleSection>

      {/* Profile (if exists) */}
      {profile && (
        <CollapsibleSection title="Perfil">
          {profile.realizacoes && (
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Realizações
              </span>
              <p className="text-sm text-foreground mt-1">{profile.realizacoes}</p>
            </div>
          )}
          {profile.visaoFuturo && (
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Visão de Futuro
              </span>
              <p className="text-sm text-foreground mt-1">{profile.visaoFuturo}</p>
            </div>
          )}
          {profile.desafiosAtuais && (
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Desafios Atuais
              </span>
              <p className="text-sm text-foreground mt-1">{profile.desafiosAtuais}</p>
            </div>
          )}
          {profile.motivacao && (
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Motivação
              </span>
              <p className="text-sm text-foreground mt-1">{profile.motivacao}</p>
            </div>
          )}
        </CollapsibleSection>
      )}
    </div>
  );
};
