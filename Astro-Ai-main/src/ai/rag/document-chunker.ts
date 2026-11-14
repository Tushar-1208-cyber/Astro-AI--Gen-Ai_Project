/**
 * ============================================================================
 * ASTRO AI — DOCUMENT CHUNKER
 * ============================================================================
 * 
 * Splits incoming educational documents, notes, or lesson materials into
 * semantically cohesive chunks with overlapping boundaries for high-accuracy RAG.
 */

export interface ChunkOptions {
  maxChunkSize?: number;   // Approximate character count per chunk (default: 600)
  chunkOverlap?: number;   // Character overlap between consecutive chunks (default: 120)
  minChunkSize?: number;   // Discard or merge chunks smaller than this (default: 40)
}

export interface DocumentChunkOutput {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tokenCount: number;
}

/**
 * Approximate token count from character length (1 token ≈ 4 characters for English)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.trim().length / 4);
}

/**
 * Splits document text into overlapping chunks while preserving sentence and paragraph boundaries.
 */
export function chunkDocument(
  text: string,
  options: ChunkOptions = {}
): DocumentChunkOutput[] {
  const maxChunkSize = options.maxChunkSize ?? 600;
  const chunkOverlap = options.chunkOverlap ?? 120;
  const minChunkSize = options.minChunkSize ?? 40;

  const sanitized = (text || '').trim();
  if (sanitized.length === 0) {
    return [];
  }

  // If text is already smaller than max chunk size, return single chunk
  if (sanitized.length <= maxChunkSize) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        content: sanitized,
        tokenCount: estimateTokenCount(sanitized),
      },
    ];
  }

  // Split into structural segments: first paragraphs, then sentences
  const paragraphs = sanitized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const rawSegments: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      rawSegments.push(para);
    } else {
      // Split long paragraph into sentences
      const sentences = para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para];
      for (const sent of sentences) {
        const trimmed = sent.trim();
        if (trimmed) {
          rawSegments.push(trimmed);
        }
      }
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const segment of rawSegments) {
    if (!currentChunk) {
      currentChunk = segment;
    } else if (currentChunk.length + segment.length + 1 <= maxChunkSize) {
      currentChunk += ' ' + segment;
    } else {
      // Chunk limit reached: push current and carry over overlap
      chunks.push(currentChunk);

      // Extract trailing text for overlap
      if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
        const overlapSlice = currentChunk.slice(currentChunk.length - chunkOverlap);
        const firstSpace = overlapSlice.indexOf(' ');
        const cleanOverlap = firstSpace !== -1 ? overlapSlice.slice(firstSpace + 1) : overlapSlice;
        currentChunk = cleanOverlap ? `${cleanOverlap} ${segment}` : segment;
      } else {
        currentChunk = segment;
      }
    }
  }

  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  } else if (chunks.length > 0 && currentChunk.trim().length > 0) {
    // Append trailing short fragment to last chunk if possible
    chunks[chunks.length - 1] += ' ' + currentChunk.trim();
  } else if (chunks.length === 0 && currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  const total = chunks.length;
  return chunks.map((content, index) => ({
    chunkIndex: index,
    totalChunks: total,
    content: content.trim(),
    tokenCount: estimateTokenCount(content.trim()),
  }));
}
