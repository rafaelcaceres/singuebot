export type UserRole = "owner" | "editor" | "viewer";

export interface Organizer {
  _id: string;
  email: string;
  role: UserRole;
}

export interface Participant {
  _id: string;
  phone: string;
  name?: string;
  consent: boolean;
  clusterId?: string;
  tags: string[];
  createdAt: number;
  isActive?: boolean;
  lastMessageTime?: number;
}

export interface Conversation {
  _id: string;
  participantId: string;
  channel: "whatsapp";
  openedAt: number;
  lastMessageAt: number;
  isOpen: boolean;
}

export interface Message {
  _id: string;
  conversationId: string;
  direction: "in" | "out";
  text: string;
  stateSnapshot?: any;
  createdAt: number;
}

export interface Template {
  _id: string;
  name: string;
  locale: string;
  twilioId: string;
  variables: string[];
  stage: string;
}

export interface Cluster {
  _id: string;
  name: string;
  description: string;
  rules?: any;
}

export interface ContentBlock {
  _id: string;
  stage: string;
  clusterId?: string;
  prompt: string;
  tips?: string[];
  cta?: string;
}

export interface Job {
  _id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed";
  payload: any;
  progress?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnalyticsEvent {
  _id: string;
  type: string;
  refId?: string;
  meta: any;
  createdAt: number;
}

export interface KPIData {
  totalParticipants: number;
  active24h: number;
  responseRate: number;
  p95Latency: number;
}

export interface CSVImportMapping {
  [csvColumn: string]: string; // maps to our field names
}

export interface CSVImportPreview {
  headers: string[];
  rows: any[][];
  mapping: CSVImportMapping;
  errors: string[];
}