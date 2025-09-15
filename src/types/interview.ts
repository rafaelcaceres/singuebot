export type InterviewStage = 
  | "intro"
  | "ASA"
  | "listas" 
  | "pre_evento"
  | "diaD"
  | "pos_24h"
  | "pos_7d"
  | "pos_30d";

export interface InterviewSession {
  participantId: string;
  step: InterviewStage;
  answers: Record<string, any>;
  lastStepAt: number;
}

export interface StateSnapshot {
  stage: InterviewStage;
  responses: Record<string, any>;
  nextActions: string[];
  contextUsed?: string[];
  lastUpdated: number;
}

export interface InterviewResponse {
  text: string;
  nextStage?: InterviewStage;
  requiresRAG?: boolean;
  contextNeeded?: string[];
}

export interface InterviewRules {
  brief: boolean;
  empathetic: boolean;
  openQuestion: string;
  microTask: string;
  subtleInvite: string;
}

export type ConversationDirection = "inbound" | "outbound";