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
  threadId?: string;

  // External tracking
  externalId?: string; // Survey/form ID for import tracking
  importSource?: string; // CSV filename for filtering imports

  // Professional information
  cargo?: string; // Job position/role
  empresa?: string; // Company name (free text)
  empresaPrograma?: string; // Company name from program dropdown (more reliable)
  setor?: string; // Industry sector

  // Demographic and program fields
  email?: string;
  estado?: string; // Brazilian state
  raca?: string; // Race/ethnicity
  genero?: string; // Gender identity
  annosCarreira?: string; // Years of career experience
  senioridade?: string; // Seniority level
  linkedin?: string;
  tipoOrganizacao?: string; // Organization type
  programaMarca?: string; // Program brand (FIB, TEMPLO, MOVER 1, etc)
  receitaAnual?: string; // Annual revenue range

  // Additional identity and verification fields
  transgenero?: boolean; // Transgender identity
  pais?: string; // Country of origin
  portfolioUrl?: string; // Portfolio or personal website URL

  // Program-specific flags for segmentation
  blackSisterInLaw?: boolean; // Black Sister in Law membership
  mercadoFinanceiro?: boolean; // Works in financial market
  membroConselho?: boolean; // Board member status
  programasPactua?: string; // Previous Pactuá programs
  programasSingue?: string; // Previous Singuê programs

  // Legacy fields (for backward compatibility)
  isActive?: boolean;
  lastMessageTime?: number;
}

export interface ParticipantProfile {
  _id: string;
  participantId: string;
  realizacoes?: string; // Professional achievements and impact
  visaoFuturo?: string; // Career vision for next 5 years
  desafiosSuperados?: string; // Barriers overcome in career
  desafiosAtuais?: string; // Current challenges for career growth
  motivacao?: string; // Motivation for joining program
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

export interface CSVImportResult {
  success: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  duplicates: Array<{
    row: number;
    phone: string;
    existingId: string;
  }>;
}

export interface CSVImportRequest {
  csvData: Array<{
    nome: string;
    telefone: string;
    externalId?: string;
    email?: string;
    cargo?: string;
    empresa?: string;
    empresaPrograma?: string;
    setor?: string;
    // Demographic fields
    estado?: string;
    raca?: string;
    genero?: string;
    annosCarreira?: string;
    senioridade?: string;
    linkedin?: string;
    tipoOrganizacao?: string;
    programaMarca?: string;
    receitaAnual?: string;
    // Additional identity fields
    transgenero?: boolean;
    pais?: string;
    portfolioUrl?: string;
    // Program-specific flags
    blackSisterInLaw?: boolean;
    mercadoFinanceiro?: boolean;
    membroConselho?: boolean;
    programasPactua?: string;
    programasSingue?: string;
    // Rich text profile fields
    realizacoes?: string;
    visaoFuturo?: string;
    desafiosSuperados?: string;
    desafiosAtuais?: string;
    motivacao?: string;
  }>;
  clusterId?: string;
  importSource?: string; // CSV filename
}