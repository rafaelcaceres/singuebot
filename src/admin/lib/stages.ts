import type { StatusTone } from "@/components/ui/status-badge";

/**
 * The interview stage vocabulary, in progression order.
 *
 * This used to be redeclared in three files with three different label sets and
 * an eight-color rainbow. A stage is a position in a sequence, not a health
 * signal, so the tone only distinguishes the two endpoints — not started, and
 * done — and leaves everything in between reading as "in progress".
 */
export const STAGE_ORDER = [
  "not_started",
  "intro",
  "termos_aceite",
  "mapeamento_carreira",
  "momento_carreira",
  "expectativas_evento",
  "objetivo_principal",
  "finalizacao",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  not_started: "Não iniciado",
  intro: "Introdução",
  termos_aceite: "Termos & Confirmação",
  mapeamento_carreira: "Mapeamento de Carreira",
  momento_carreira: "Momento de Carreira",
  expectativas_evento: "Expectativas do Evento",
  objetivo_principal: "Objetivo Principal",
  finalizacao: "Finalização",
};

/** Falls back to the raw value so an unmapped backend stage stays legible. */
export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  return STAGE_LABELS[stage as Stage] ?? stage;
}

export function stageTone(stage: string | null | undefined): StatusTone {
  if (stage === "finalizacao") return "success";
  if (!stage || stage === "not_started") return "neutral";
  return "info";
}

/** Options for filter selects, in progression order. */
export const STAGE_OPTIONS = STAGE_ORDER.map((value) => ({
  value,
  label: STAGE_LABELS[value],
}));
