import { DocumentFormat } from "@/types/rag";

// File size limit: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

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
 * Validates file size (max 2MB)
 */
export function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

/**
 * Validates multiple files total size (max 2MB combined)
 */
export function validateTotalFileSize(files: File[]): boolean {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return totalSize <= MAX_FILE_SIZE;
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!validateDocumentFormat(file)) {
    errors.push('Formato de arquivo não suportado. Use PDF, MD ou TXT.');
  }
  
  if (!validateFileSize(file)) {
    errors.push(`Arquivo muito grande. Máximo permitido: ${formatFileSize(MAX_FILE_SIZE)}.`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates multiple files
 */
export function validateFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check individual files
  for (const file of files) {
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      errors.push(`${file.name}: ${fileValidation.errors.join(', ')}`);
    }
  }
  
  // Check total size
  if (!validateTotalFileSize(files)) {
    errors.push(`Tamanho total dos arquivos excede ${formatFileSize(MAX_FILE_SIZE)}.`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
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
 * Process PDF file (placeholder - would need PDF.js or similar)
 */
export async function processPDFFile(file: File): Promise<string> {
  // For now, return a placeholder
  // In a real implementation, you'd use PDF.js or similar library
  throw new Error('PDF processing not yet implemented. Please use TXT or MD files for now.');
}

/**
 * Process document file based on format
 */
export async function processDocumentFile(file: File): Promise<string> {
  const format = getDocumentFormat(file);
  
  switch (format) {
    case 'txt':
    case 'md':
      return await readFileAsText(file);
    case 'pdf':
      return await processPDFFile(file);
    default:
      throw new Error('Unsupported file format');
  }
}

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(content: string, filename: string): string {
  // Simple hash function - in production, use crypto.subtle.digest
  let hash = 0;
  const str = content + filename;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
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
  
  // Common patterns for career development
  if (name.includes('carreira')) tags.push('carreira');
  if (name.includes('lideranca') || name.includes('liderança')) tags.push('liderança');
  if (name.includes('empreendedorismo')) tags.push('empreendedorismo');
  if (name.includes('desenvolvimento')) tags.push('desenvolvimento');
  if (name.includes('profissional')) tags.push('profissional');
  if (name.includes('networking')) tags.push('networking');
  if (name.includes('mentoria')) tags.push('mentoria');
  
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
    const validTemaValues = ['carreira', 'liderança', 'empreendedorismo', 'desenvolvimento', 'networking'];
    const validNivelValues = ['iniciante', 'intermediario', 'avancado'];
    
    if (filters.tema && !validTemaValues.includes(filters.tema)) {
      errors.push('Valor de tema inválido');
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