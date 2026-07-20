/**
 * Shared Twilio REST helpers.
 *
 * No Convex imports — this module is consumed by both convex/functions/twilio.ts
 * and convex/functions/broadcastSender.ts, which are separate "use node" actions.
 * Keeping the POST in one place is what stops the two send paths from drifting
 * apart again (they had already grown three near-duplicate implementations).
 */

export const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_WHATSAPP_NUMBER,
};

export function twilioAuthHeader(): string {
  const { accountSid, authToken } = TWILIO_CONFIG;
  if (!accountSid || !authToken) {
    throw new Error("Credenciais do Twilio não configuradas (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
  }
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

export function withWhatsAppPrefix(number: string): string {
  const trimmed = number.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

export function resolveFromNumber(): string {
  if (!TWILIO_CONFIG.fromNumber) {
    throw new Error("TWILIO_WHATSAPP_NUMBER não configurado.");
  }
  return withWhatsAppPrefix(TWILIO_CONFIG.fromNumber);
}

/**
 * Portuguese descriptions for the Twilio errors this app actually hits.
 * The failures table groups by code, so the operator sees "42 números inválidos"
 * instead of 42 identical JSON blobs.
 */
const ERROR_DESCRIPTIONS: Record<number, string> = {
  [-1]: "Estado desconhecido — a mensagem pode ter sido enviada",
  20429: "Limite de envio do Twilio atingido",
  21211: "Número de telefone inválido",
  21610: "Destinatário bloqueou ou cancelou o recebimento",
  21612: "Não é possível enviar para este número por este canal",
  21656: "ContentVariables inválido para este template",
  // 63002/63007 are about the SENDER, not the recipient — the number in
  // TWILIO_WHATSAPP_NUMBER is not currently a registered WhatsApp sender on the
  // account. Nothing in the app can fix it; it is resolved in the Twilio Console.
  63002: "Número remetente não está registrado como sender WhatsApp no Twilio",
  63003: "Destino não encontrado no WhatsApp",
  63005: "Mensagem bloqueada pelo WhatsApp",
  63007: "Número remetente não está registrado como sender WhatsApp no Twilio",
  63016: "Template não aprovado ou mensagem livre fora da janela de 24h",
  63024: "Parâmetros do template inválidos",
  63051: "Limite de mensagens do WhatsApp atingido para este número",
};

export function describeTwilioError(code: number | undefined, fallback: string): string {
  if (code !== undefined && ERROR_DESCRIPTIONS[code]) {
    return ERROR_DESCRIPTIONS[code];
  }
  return fallback || "Erro desconhecido no envio";
}

export class TwilioSendError extends Error {
  readonly code: number | undefined;
  readonly httpStatus: number | undefined;
  readonly retryable: boolean;

  constructor(params: {
    code?: number;
    httpStatus?: number;
    message: string;
    retryable: boolean;
  }) {
    super(describeTwilioError(params.code, params.message));
    this.name = "TwilioSendError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.retryable = params.retryable;
  }
}

function isRetryableStatus(httpStatus: number, code: number | undefined): boolean {
  if (httpStatus === 429) return true;
  if (httpStatus >= 500) return true;
  if (code === 20429) return true;
  return false;
}

async function parseTwilioError(response: Response): Promise<TwilioSendError> {
  const raw = await response.text();
  let code: number | undefined;
  let message = raw;

  try {
    const parsed = JSON.parse(raw) as { code?: number; message?: string };
    if (typeof parsed.code === "number") code = parsed.code;
    if (typeof parsed.message === "string") message = parsed.message;
  } catch {
    // Twilio occasionally returns non-JSON (proxy errors); keep the raw text.
  }

  return new TwilioSendError({
    code,
    httpStatus: response.status,
    message,
    retryable: isRetryableStatus(response.status, code),
  });
}

export interface TwilioMessageResponse {
  sid: string;
  status?: string;
  [key: string]: unknown;
}

async function postMessage(params: URLSearchParams): Promise<TwilioMessageResponse> {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    throw await parseTwilioError(response);
  }

  return (await response.json()) as TwilioMessageResponse;
}

/**
 * Send an HSM (Content API) template.
 *
 * `contentVariables` keys must already be the literal Twilio keys — see
 * convex/functions/templateVariables.ts. Passing app-side variable names here is
 * exactly the bug that made every template render blank.
 */
export async function postTemplateMessage(args: {
  to: string;
  contentSid: string;
  contentVariables: Record<string, string>;
  statusCallback?: string;
}): Promise<TwilioMessageResponse> {
  const params = new URLSearchParams({
    From: resolveFromNumber(),
    To: withWhatsAppPrefix(args.to),
    ContentSid: args.contentSid,
    ContentVariables: JSON.stringify(args.contentVariables ?? {}),
  });

  if (args.statusCallback) {
    params.append("StatusCallback", args.statusCallback);
  }

  return postMessage(params);
}

/**
 * The status callback URL for delivery receipts. The /whatsapp/status route already
 * exists in convex/router.ts but has never received anything, because no send path
 * set this parameter.
 */
export function statusCallbackUrl(): string | undefined {
  const siteUrl = process.env.CONVEX_SITE_URL;
  return siteUrl ? `${siteUrl}/whatsapp/status` : undefined;
}
