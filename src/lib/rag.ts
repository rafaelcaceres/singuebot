import { DocumentFormat } from "@/types/rag";

/**
 * Validates file format for document upload
 */
export function validateDocumentFormat(file: File): boolean {
  const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
  const allowedExtensions = ['.txt', '.md', '.pdf'];
  
  const hasValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  return hasValidType || hasValidExtension;
}

/**
 * Extracts format from file
 */
export function getDocumentFormat(file: File): DocumentFormat {
  if (file.name.toLowerCase().endsWith('.md')) return 'md';
  if (file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'txt';
}

/**
 * Reads file content as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('File reading failed'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Estimates token count for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extracts tags from filename
 */
export function extractTagsFromFilename(filename: string): string[] {
  const tags: string[] = [];
  const name = filename.toLowerCase();
  
  // Common patterns
  if (name.includes('asa')) tags.push('ASA');
  if (name.includes('carreira')) tags.push('carreira');
  if (name.includes('lideranca') || name.includes('liderança')) tags.push('liderança');
  if (name.includes('empreendedorismo')) tags.push('empreendedorismo');
  if (name.includes('ancestralidade')) tags.push('ancestralidade');
  if (name.includes('sabedoria')) tags.push('sabedoria');
  if (name.includes('ascensao') || name.includes('ascensão')) tags.push('ascensão');
  
  return tags;
}

/**
 * Validates RAG query parameters
 */
export function validateRAGQuery(query: string, filters?: any): {valid: boolean, errors: string[]} {
  const errors: string[] = [];
  
  if (!query || query.trim().length < 3) {
    errors.push('Query deve ter pelo menos 3 caracteres');
  }
  
  if (query.length > 500) {
    errors.push('Query deve ter no máximo 500 caracteres');
  }
  
  if (filters) {
    const validASAValues = ['ancestralidade', 'sabedoria', 'ascensão'];
    const validNivelValues = ['iniciante', 'intermediario', 'avancado'];
    
    if (filters.asa && !validASAValues.includes(filters.asa)) {
      errors.push('Valor ASA inválido');
    }
    
    if (filters.nivel && !validNivelValues.includes(filters.nivel)) {
      errors.push('Valor de nível inválido');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Highlights search terms in text
 */
export function highlightSearchTerms(text: string, query: string): string {
  if (!query) return text;
  
  const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  let highlightedText = text;
  
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  });
  
  return highlightedText;
}

/**
 * Truncates text preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Calculates similarity score display
 */
export function formatSimilarityScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Groups chunks by document for display
 */
export function groupChunksByDocument(chunks: any[]): Record<string, any[]> {
  return chunks.reduce((groups, chunk) => {
    const docTitle = chunk.docTitle || 'Unknown Document';
    if (!groups[docTitle]) {
      groups[docTitle] = [];
    }
    groups[docTitle].push(chunk);
    return groups;
  }, {});
}