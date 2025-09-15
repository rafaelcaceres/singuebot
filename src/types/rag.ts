export interface KnowledgeDocument {
  _id: string;
  title: string;
  source: string;
  tags: string[];
  status: "ingested" | "pending" | "failed";
  createdAt: number;
}

export interface KnowledgeChunk {
  _id: string;
  docId: string;
  chunk: string;
  embedding: number[];
  tags: {
    asa?: string;
    tema?: string;
    nivel?: string;
  };
}

export interface RAGQuery {
  query: string;
  filters?: {
    asa?: string;
    tema?: string;
    nivel?: string;
  };
  topK?: number;
}

export interface RAGResult {
  chunk: string;
  score: number;
  tags: {
    asa?: string;
    tema?: string;
    nivel?: string;
  };
  docTitle: string;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface ChunkingOptions {
  maxTokens: number;
  overlap: number;
  preserveFormatting?: boolean;
}

export type DocumentFormat = "txt" | "md" | "pdf";