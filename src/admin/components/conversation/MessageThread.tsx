import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface ThreadMessage {
  _id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  timestamp: number;
  mediaUrl?: string;
  mediaContentType?: string;
  aiMetadata?: {
    model: string;
    tokens: number;
    processingTimeMs: number;
    fallbackUsed: boolean;
  };
  audioTranscription?: {
    transcribedText: string;
  };
}

interface MessageThreadProps {
  messages: ThreadMessage[];
  /** Resets scroll-to-bottom behaviour when the open conversation changes. */
  conversationKey: string;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const isToday = date.toDateString() === new Date().toDateString();

  return isToday
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/**
 * Delivery state carries a label as well as a glyph — a checkmark that only
 * differs by count is not something a screen reader user can act on.
 */
const DELIVERY_STATUS: Record<string, { glyph: string; label: string }> = {
  sent: { glyph: '✓', label: 'Enviada' },
  delivered: { glyph: '✓✓', label: 'Entregue' },
  read: { glyph: '✓✓', label: 'Lida' },
  failed: { glyph: '✗', label: 'Falhou' },
};

const PENDING = { glyph: '○', label: 'Pendente' };

/**
 * The one message thread in the console. Both the inbox and anything that deep
 * links into a conversation render this — there used to be a second, subtly
 * different copy inside the conversation viewer modal.
 */
export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  conversationKey,
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const previousKey = useRef(conversationKey);

  useEffect(() => {
    if (previousKey.current !== conversationKey) {
      isInitialLoad.current = true;
      previousKey.current = conversationKey;
    }
  }, [conversationKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: isInitialLoad.current ? 'auto' : 'smooth',
    });
    isInitialLoad.current = false;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="grow overflow-y-auto p-4 bg-muted/40 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Nenhuma mensagem trocada com este participante ainda.
        </p>
      </div>
    );
  }

  return (
    // `relative` is load-bearing: the sr-only delivery labels below are
    // position:absolute, and without a positioned ancestor they escape this
    // scroll container and land at document coordinates, stretching the page's
    // scrollHeight to the full length of the thread.
    <div className="relative grow overflow-y-auto p-4 bg-muted/40">
      <ol className="max-w-3xl mx-auto space-y-3">
        {messages.map((message) => {
          const outbound = message.direction === 'outbound';
          const delivery = DELIVERY_STATUS[message.status] ?? PENDING;

          return (
            <li
              key={message._id}
              className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] px-3 py-2 rounded-2xl',
                  outbound
                    ? 'bg-chat-outbound text-chat-outbound-foreground rounded-br-md'
                    : 'bg-chat-inbound text-chat-inbound-foreground rounded-bl-md border border-border'
                )}
              >
                {message.mediaUrl && (
                  <div className="mb-2">
                    {message.mediaContentType?.startsWith('image/') ? (
                      <img
                        src={message.mediaUrl}
                        alt="Mídia enviada na conversa"
                        className="max-w-full h-auto rounded"
                      />
                    ) : (
                      <a
                        href={message.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        Arquivo anexo
                      </a>
                    )}
                  </div>
                )}

                {message.audioTranscription && (
                  <div
                    className={cn(
                      'text-xs mb-1',
                      outbound ? 'opacity-80' : 'text-muted-foreground'
                    )}
                  >
                    Áudio transcrito
                  </div>
                )}

                <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>

                <div
                  className={cn(
                    'flex items-center justify-between gap-3 mt-1 text-xs',
                    outbound ? 'opacity-80' : 'text-muted-foreground'
                  )}
                >
                  <time dateTime={new Date(message.timestamp).toISOString()}>
                    {formatTimestamp(message.timestamp)}
                  </time>
                  <div className="flex items-center gap-1.5">
                    {message.aiMetadata && (
                      <span
                        className={cn(
                          'px-1 rounded',
                          outbound ? 'bg-background/25' : 'bg-muted'
                        )}
                        title={`Resposta da IA — ${message.aiMetadata.model}, ${message.aiMetadata.tokens} tokens${
                          message.aiMetadata.fallbackUsed ? ', fallback usado' : ''
                        }`}
                      >
                        IA
                      </span>
                    )}
                    {outbound && (
                      <span title={delivery.label}>
                        <span aria-hidden="true">{delivery.glyph}</span>
                        <span className="sr-only">{delivery.label}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
};
