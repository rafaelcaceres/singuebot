import type { StatusTone } from '@/components/ui/status-badge';

/**
 * The WhatsApp 24-hour service window, as the backend reports it.
 *
 * `isOpen` is advisory: it is derived from when our webhook recorded the
 * participant's last message, which can drift from Meta's own clock by seconds.
 * Twilio error 63016 is the authority. Showing it anyway is the point — the
 * alternative is an operator typing into a message that will never arrive.
 */
export interface ConversationWindow {
  lastInboundAt: number | null;
  expiresAt: number | null;
  isOpen: boolean;
}

export const CLOSED_WINDOW: ConversationWindow = {
  lastInboundAt: null,
  expiresAt: null,
  isOpen: false,
};

/** "3h12" / "18min" — coarse on purpose; the exact second is never actionable. */
export function formatWindowRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'menos de 1min';

  const totalMinutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}min`;
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`;
}

export function windowBadge(window: ConversationWindow): {
  tone: StatusTone;
  label: string;
} {
  if (!window.isOpen || !window.expiresAt) {
    return { tone: 'warning', label: 'Janela fechada — só template' };
  }

  const remaining = window.expiresAt - Date.now();
  const tone: StatusTone = remaining < 2 * 60 * 60 * 1000 ? 'warning' : 'success';

  return { tone, label: `Janela aberta · ${formatWindowRemaining(window.expiresAt)}` };
}
