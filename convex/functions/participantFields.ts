/**
 * Canonical list of participant fields that can be mapped to HSM template variables.
 *
 * Hand-maintained mirror of the `participants` table in convex/schema.ts:276-332 —
 * Convex does not expose the schema shape at runtime. When a field is added to the
 * table and should be usable in a template, add it here too.
 *
 * Only scalar fields are listed: a template variable interpolates to a string, so
 * arrays (`tags`) and references (`clusterId`) are deliberately excluded.
 */

export type ParticipantFieldGroup =
  | "identidade"
  | "profissional"
  | "demografia"
  | "programa";

export interface ParticipantField {
  key: string;
  label: string;
  type: "string" | "boolean" | "number";
  group: ParticipantFieldGroup;
}

export const PARTICIPANT_FIELDS: ParticipantField[] = [
  // Identidade
  { key: "name", label: "Nome", type: "string", group: "identidade" },
  { key: "phone", label: "Telefone", type: "string", group: "identidade" },
  { key: "email", label: "E-mail", type: "string", group: "identidade" },
  { key: "linkedin", label: "LinkedIn", type: "string", group: "identidade" },
  { key: "portfolioUrl", label: "Portfólio / site", type: "string", group: "identidade" },
  { key: "externalId", label: "ID externo", type: "string", group: "identidade" },

  // Profissional
  { key: "cargo", label: "Cargo", type: "string", group: "profissional" },
  { key: "empresa", label: "Empresa", type: "string", group: "profissional" },
  { key: "empresaPrograma", label: "Empresa (programa)", type: "string", group: "profissional" },
  { key: "setor", label: "Setor", type: "string", group: "profissional" },
  { key: "senioridade", label: "Senioridade", type: "string", group: "profissional" },
  { key: "annosCarreira", label: "Anos de carreira", type: "string", group: "profissional" },
  { key: "tipoOrganizacao", label: "Tipo de organização", type: "string", group: "profissional" },
  { key: "receitaAnual", label: "Receita anual", type: "string", group: "profissional" },
  { key: "mercadoFinanceiro", label: "Mercado financeiro", type: "boolean", group: "profissional" },
  { key: "membroConselho", label: "Membro de conselho", type: "boolean", group: "profissional" },

  // Demografia
  { key: "estado", label: "Estado", type: "string", group: "demografia" },
  { key: "pais", label: "País", type: "string", group: "demografia" },
  { key: "raca", label: "Raça/etnia", type: "string", group: "demografia" },
  { key: "genero", label: "Gênero", type: "string", group: "demografia" },
  { key: "transgenero", label: "Pessoa trans", type: "boolean", group: "demografia" },

  // Programa
  { key: "programaMarca", label: "Marca do programa", type: "string", group: "programa" },
  { key: "programasPactua", label: "Programas Pactuá", type: "string", group: "programa" },
  { key: "programasSingue", label: "Programas Singuê", type: "string", group: "programa" },
  { key: "blackSisterInLaw", label: "Black Sister in Law", type: "boolean", group: "programa" },
  { key: "importSource", label: "Origem da importação", type: "string", group: "programa" },
  { key: "consent", label: "Consentimento LGPD", type: "boolean", group: "programa" },
];

export const PARTICIPANT_FIELD_GROUP_LABELS: Record<ParticipantFieldGroup, string> = {
  identidade: "Identidade",
  profissional: "Profissional",
  demografia: "Demografia",
  programa: "Programa",
};

const FIELD_KEYS = new Set(PARTICIPANT_FIELDS.map((f) => f.key));

export function isMappableParticipantField(key: string): boolean {
  return FIELD_KEYS.has(key);
}

/**
 * Render a participant field as the string that goes into a template variable.
 * Booleans become "Sim"/"Não" rather than "true"/"false" — these values are read
 * by humans in a WhatsApp message.
 */
export function formatParticipantFieldValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}
