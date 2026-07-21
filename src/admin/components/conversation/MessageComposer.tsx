import React, { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { Loader2, Send, UserCheck, Undo2 } from 'lucide-react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatWindowRemaining, type ConversationWindow } from '@/admin/lib/messageWindow';

interface MessageComposerProps {
  participantId: Id<'participants'>;
  operatorMode: boolean;
  window: ConversationWindow;
  onTakeOver: () => void | Promise<void>;
  onRelease: () => void | Promise<void>;
}

/**
 * Three states, in the order the coordinator hits them:
 *
 *  1. the assistant is still answering  -> you must take over before you speak
 *  2. you have the conversation and the 24-hour window is open -> free text
 *  3. the window has closed -> only an approved template will leave the building
 *
 * State 3 used to be invisible: the input looked identical and the message
 * simply never arrived.
 */
export const MessageComposer: React.FC<MessageComposerProps> = ({
  participantId,
  operatorMode,
  window: messageWindow,
  onTakeOver,
  onRelease,
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [templateId, setTemplateId] = useState<string>('');

  const sendMessage = useAction(api.operatorDashboard.sendOperatorMessage);
  const sendTemplate = useAction(api.operatorDashboard.sendOperatorTemplate);

  // Only fetched when it's the only way to reach the participant.
  const templates = useQuery(
    api.admin.getTemplates,
    operatorMode && !messageWindow.isOpen ? {} : 'skip'
  );
  const approvedTemplates = (templates ?? []).filter(
    (t: { approvalStatus?: string }) => t.approvalStatus === 'approved'
  );

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({ participantId, message: message.trim() });
      setMessage('');
    } catch (error) {
      toast.error('Não foi possível enviar a mensagem', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!templateId || isSending) return;

    setIsSending(true);
    try {
      await sendTemplate({
        participantId,
        templateId: templateId as Id<'templates'>,
      });
      setTemplateId('');
      toast.success('Template enviado');
    } catch (error) {
      toast.error('Não foi possível enviar o template', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSending(false);
    }
  };

  // State 1 — the assistant still owns this conversation.
  if (!operatorMode) {
    return (
      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 p-4">
          <div>
            <p className="text-sm text-foreground">
              Para enviar mensagens, assuma a conversa.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              A IA será pausada e não responderá mais automaticamente.
            </p>
          </div>
          <Button onClick={() => void onTakeOver()} className="shrink-0 gap-2">
            <UserCheck className="h-4 w-4" />
            Assumir conversa
          </Button>
        </div>
      </div>
    );
  }

  // State 3 — window closed, templates only.
  if (!messageWindow.isOpen) {
    return (
      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="rounded-lg border border-border bg-warning-muted p-3">
            <p className="text-sm font-medium text-warning-muted-foreground">
              Janela de 24 horas fechada
            </p>
            <p className="text-xs text-warning-muted-foreground/90 mt-1">
              {messageWindow.lastInboundAt
                ? 'O participante não escreve há mais de 24 horas. O WhatsApp só entrega um template aprovado até que ele responda.'
                : 'Este participante nunca escreveu para você. Só é possível iniciar a conversa com um template aprovado.'}
            </p>
          </div>

          <div className="flex gap-2">
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="flex-1" aria-label="Template aprovado">
                <SelectValue
                  placeholder={
                    templates === undefined
                      ? 'Carregando templates...'
                      : approvedTemplates.length === 0
                        ? 'Nenhum template aprovado disponível'
                        : 'Escolha um template aprovado'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map((template: { _id: string; name: string }) => (
                  <SelectItem key={template._id} value={template._id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => void handleSendTemplate()}
              disabled={!templateId || isSending}
              className="gap-2"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar template
            </Button>
          </div>

          <ReleaseRow onRelease={onRelease} />
        </div>
      </div>
    );
  }

  // State 2 — you have the conversation and the window is open.
  return (
    <div className="shrink-0 border-t border-border bg-card p-3">
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="flex gap-2">
          <label htmlFor="operator-message" className="sr-only">
            Mensagem para o participante
          </label>
          <Input
            id="operator-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Digite sua mensagem..."
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!message.trim() || isSending}
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Você está no controle. A IA está pausada para este participante.
            {messageWindow.expiresAt && (
              <>
                {' '}
                Janela aberta por mais {formatWindowRemaining(messageWindow.expiresAt)}.
              </>
            )}
          </p>
          <ReleaseRow onRelease={onRelease} inline />
        </div>
      </div>
    </div>
  );
};

const ReleaseRow: React.FC<{ onRelease: () => void | Promise<void>; inline?: boolean }> = ({
  onRelease,
  inline,
}) => (
  <div className={inline ? '' : 'flex justify-end'}>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void onRelease()}
      className="gap-1.5 text-xs h-auto py-1"
    >
      <Undo2 className="h-3 w-3" />
      Devolver para IA
    </Button>
  </div>
);
