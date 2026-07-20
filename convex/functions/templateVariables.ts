/**
 * Pure helpers for mapping app-side template variables onto Twilio ContentVariables.
 *
 * No Convex imports on purpose — this is the piece that got the send path wrong for
 * so long, so it must be readable and testable in isolation.
 *
 * The rule Twilio actually enforces: the keys of `ContentVariables` must match the
 * literal token inside the braces in the Content template body. A body written with
 * `{{1}}` needs `{"1": "Ana"}`; a body written with `{{nome}}` needs `{"nome": "Ana"}`.
 * Our own variable naming ("nome", "cargo") is an app-side concept and is NOT what
 * Twilio matches on — conflating the two is what silently produced empty messages.
 */

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Extract the placeholder tokens from a template body, in order of first appearance
 * and without duplicates. `Olá {{1}}, tudo bem {{1}}? Você é {{2}}` -> ["1", "2"].
 */
export function extractBodyTokens(body: string | undefined | null): string[] {
  if (!body) return [];
  const seen: string[] = [];
  for (const match of body.matchAll(TOKEN_RE)) {
    const token = match[1];
    if (!seen.includes(token)) seen.push(token);
  }
  return seen;
}

export function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token);
}

/**
 * Resolve the Twilio ContentVariables key for one app-side variable.
 *
 * @param templateVariable the app-side name the admin configured (e.g. "nome")
 * @param twilioVariableKeys Object.keys(content.variables) from the Content API — authoritative when present
 * @param bodyTokens tokens parsed out of the body, used both to recognise named templates and to order positional ones
 * @param position index of this variable among the template's variables (0-based)
 */
export function deriveContentKey(
  templateVariable: string,
  twilioVariableKeys: string[],
  bodyTokens: string[],
  position: number,
): string {
  // Already positional — Twilio wants it verbatim.
  if (isNumericToken(templateVariable)) return templateVariable;

  // The template genuinely uses named placeholders and this is one of them.
  if (twilioVariableKeys.includes(templateVariable)) return templateVariable;
  if (bodyTokens.includes(templateVariable)) return templateVariable;

  // Named app-side variable against a positional template: fall back to the token
  // sitting at this position. Prefer the real token over position+1 so that bodies
  // with non-contiguous placeholders ({{1}} … {{3}}) still resolve correctly.
  const token = bodyTokens[position];
  if (token !== undefined) return token;

  return String(position + 1);
}

/**
 * Substitute a ContentVariables object back into a body, for preview.
 * Unfilled tokens are left visible as «token» so a missing mapping is obvious
 * in the composer rather than silently rendering as an empty gap.
 */
export function renderTemplateBody(
  body: string | undefined | null,
  contentVariables: Record<string, string>,
): string {
  if (!body) return "";
  return body.replace(TOKEN_RE, (_full, token: string) => {
    const value = contentVariables[token];
    return value !== undefined && value !== "" ? value : `«${token}»`;
  });
}

export interface ResolvedMapping {
  contentKey: string;
  templateVariable: string;
  participantField?: string;
  defaultValue?: string;
  isRequired: boolean;
}

/**
 * Resolve one participant into the ContentVariables payload Twilio will receive.
 *
 * Precedence: manual override > participant field > default value. A required
 * variable that resolves to nothing is reported back so the composer can warn
 * before sending rather than delivering a message with a visible gap.
 */
export function resolveContentVariables(
  mappings: ResolvedMapping[],
  participant: Record<string, unknown>,
  overrides: Record<string, string> | undefined,
  formatValue: (value: unknown) => string,
): { contentVariables: Record<string, string>; missingRequired: string[] } {
  const contentVariables: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const mapping of mappings) {
    let value = "";

    if (mapping.participantField) {
      value = formatValue(participant[mapping.participantField]);
    }

    const override = overrides?.[mapping.templateVariable];
    if (override) value = override;

    if (!value && mapping.defaultValue) value = mapping.defaultValue;

    if (!value && mapping.isRequired) {
      missingRequired.push(mapping.templateVariable);
    }

    contentVariables[mapping.contentKey] = value;
  }

  return { contentVariables, missingRequired };
}

/**
 * Union of the variable names Twilio reports and the tokens present in the body.
 * The API's `variables` map is authoritative when populated, but it is empty for
 * some content types, so the body regex backfills it.
 */
export function resolveTemplateVariables(
  twilioVariables: Record<string, unknown> | undefined | null,
  body: string | undefined | null,
): string[] {
  const fromApi = twilioVariables ? Object.keys(twilioVariables) : [];
  const fromBody = extractBodyTokens(body);
  const merged = [...fromApi];
  for (const token of fromBody) {
    if (!merged.includes(token)) merged.push(token);
  }
  return merged;
}
