import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Pencil, X, Check } from 'lucide-react';

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
  onToggleAttention: () => void;
  onToggleDetails: () => void;
  showDetails: boolean;
  participantId: Id<'participants'>;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  participant,
  context,
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
        participantId: participantId as any,
        updates: { name: editedName.trim() },
      });
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Erro ao salvar nome. Tente novamente.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(participant.name || '');
    setIsEditingName(false);
  };

  const formatPhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  return (
    <div className="shrink-0 px-4 py-3 border-b bg-gray-50">
      <div className="flex items-center justify-between">
        {/* Contact Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
            {participant.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="text-base font-medium border-b-2 border-blue-500 bg-transparent focus:outline-none px-0 py-0.5 w-40"
                  placeholder="Digite o nome..."
                  disabled={isSavingName}
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSavingName || !editedName.trim()}
                  className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSavingName}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2
                  onClick={() => setIsEditingName(true)}
                  className="text-base font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                  title="Clique para editar"
                >
                  {participant.name || 'Sem nome'}
                </h2>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500">{formatPhone(participant.phone)}</p>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 ml-2">
            {context.operatorMode && (
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                Modo Operador
              </span>
            )}
            {context.needsHuman && (
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full animate-pulse">
                Precisa Atenção
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Toggle Attention */}
          <button
            onClick={onToggleAttention}
            className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
              context.needsHuman
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
            title={context.needsHuman ? 'Remover flag' : 'Marcar como precisa atenção'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {context.needsHuman ? 'Resolver' : 'Marcar'}
          </button>

          {/* Toggle Details */}
          <button
            onClick={onToggleDetails}
            className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
              showDetails
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
