import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Pencil, X, Check, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { windowBadge, type ConversationWindow } from '@/admin/lib/messageWindow';

interface Participant {
  name?: string;
  phone: string;
}

interface Context {
  needsHuman: boolean;
  operatorMode: boolean;
}

interface ConversationHeaderProps {
  participant: Participant;
  context: Context;
  window: ConversationWindow;
  onToggleAttention: () => void;
  onToggleDetails: () => void;
  showDetails: boolean;
  participantId: Id<'participants'>;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  participant,
  context,
  window: messageWindow,
  onToggleAttention,
  onToggleDetails,
  showDetails,
  participantId,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(participant.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const updateParticipant = useMutation(api.admin.updateParticipant);

  useEffect(() => {
    if (participant.name) {
      setEditedName(participant.name);
    }
  }, [participant.name]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleSaveName = async () => {
    if (!editedName.trim() || isSavingName) return;

    setIsSavingName(true);
    try {
      await updateParticipant({
        participantId,
        updates: { name: editedName.trim() },
      });
      setIsEditingName(false);
    } catch (error) {
      toast.error('Não foi possível salvar o nome', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(participant.name || '');
    setIsEditingName(false);
  };

  const windowState = windowBadge(messageWindow);

  return (
    <div className="shrink-0 px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-hidden="true"
            className="w-10 h-10 shrink-0 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium text-sm"
          >
            {participant.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <label htmlFor="participant-name" className="sr-only">
                  Nome do participante
                </label>
                <Input
                  id="participant-name"
                  ref={nameInputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="h-8 w-44 text-base font-medium"
                  placeholder="Digite o nome..."
                  disabled={isSavingName}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void handleSaveName()}
                  disabled={isSavingName || !editedName.trim()}
                  aria-label="Salvar nome"
                  className="h-8 w-8"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isSavingName}
                  aria-label="Cancelar edição do nome"
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              // A real button, not an h2 with onClick — the old version was
              // unreachable by keyboard.
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-base font-medium text-foreground truncate">
                  {participant.name || 'Sem nome'}
                </h2>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsEditingName(true)}
                  aria-label={`Editar nome de ${participant.name || 'participante sem nome'}`}
                  className="h-6 w-6 shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">{formatPhone(participant.phone)}</p>
          </div>

          <div className="flex items-center gap-2 ml-2 flex-wrap">
            {/* The single most consequential fact about this conversation: can a
                free-form message even be delivered right now. */}
            <StatusBadge tone={windowState.tone} dot>
              {windowState.label}
            </StatusBadge>
            {context.operatorMode && <StatusBadge tone="info">Modo operador</StatusBadge>}
            {context.needsHuman && (
              <StatusBadge tone="danger" icon={AlertTriangle}>
                Precisa atenção
              </StatusBadge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={context.needsHuman ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleAttention}
            className="gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            {context.needsHuman ? 'Resolver' : 'Marcar atenção'}
          </Button>

          <Button
            variant={showDetails ? 'secondary' : 'outline'}
            size="sm"
            onClick={onToggleDetails}
            aria-pressed={showDetails}
            className="gap-2"
          >
            <Info className="w-4 h-4" />
            Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
};
