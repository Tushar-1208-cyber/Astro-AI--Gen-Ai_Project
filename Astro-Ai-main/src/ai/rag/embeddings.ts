/**
 * ============================================================================
 * ASTRO AI — EMBEDDING GENERATOR
 * ============================================================================
 * 
 * Provides vector embeddings for document chunks and user queries.
 * Supports cloud embeddings via Google GenAI (@genkit-ai/googleai) when a key is present,
 * and a robust deterministic semantic local vectorizer for full offline functionality.
 */

import crypto from 'crypto';

export const LOCAL_EMBEDDING_DIMENSION = 384;
export const CLOUD_EMBEDDING_DIMENSION = 768;
export const EMBEDDING_DIMENSION = LOCAL_EMBEDDING_DIMENSION;

export const LOCAL_EMBEDDING_MODEL = 'deterministic-ngram-384';
export const CLOUD_EMBEDDING_MODEL = 'text-embedding-004';

export interface EmbeddingMetadata {
  embedding: number[];
  provider: 'local' | 'google-genai';
  model: string;
  dimension: number;
}

export class EmbeddingDimensionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingDimensionMismatchError';
  }
}

/**
 * Validates that two embedding vectors or spaces have identical dimensions and matching providers
 */
export function validateEmbeddingMatch(
  query: { dimension: number; provider?: string },
  chunk: { dimension: number; provider?: string }
): void {
  if (query.dimension !== chunk.dimension) {
    throw new EmbeddingDimensionMismatchError(
      `Embedding Dimension Mismatch: Query vector dimension (${query.dimension}) does not match chunk vector dimension (${chunk.dimension}). Cannot calculate cosine similarity across disparate vector spaces.`
    );
  }
  if (query.provider && chunk.provider && query.provider !== chunk.provider) {
    throw new EmbeddingDimensionMismatchError(
      `Embedding Provider Mismatch: Query provider (${query.provider}) does not match chunk index provider (${chunk.provider}).`
    );
  }
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'or', 'by',
  'with', 'as', 'into', 'using', 'from', 'that', 'this', 'are', 'was', 'were', 'it', 'its'
]);

/**
 * Calculates cosine similarity between two dense vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalizes a vector to unit length (L2 norm)
 */
export function l2Normalize(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  const magnitude = Math.sqrt(norm);
  if (magnitude === 0) {
    return vec;
  }
  return vec.map((v) => v / magnitude);
}

/**
 * Local deterministic semantic vectorizer (128-dim dense embedding)
 * Maps words, n-grams, and context positions into a continuous representation space.
 */
function generateLocalEmbedding(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  const normalizedText = (text || '').toLowerCase().trim();

  if (normalizedText.length === 0) {
    return vector;
  }

  // Tokenize into words and filter stop words
  const words = normalizedText
    .split(/[\s,.;:!?()\[\]{}"'`/\\]+/)
    .filter((w) => w && w.length > 1 && !STOP_WORDS.has(w));

  // 1. Unigram feature projection with basic suffix stemming
  for (const word of words) {
    const stem = word.replace(/(ing|ed|es|s)$/, '');
    const hash = crypto.createHash('sha256').update(stem).digest();
    const bucket = hash.readUInt16BE(0) % EMBEDDING_DIMENSION;
    vector[bucket] += 1.0 + Math.log(1 + stem.length);

    // 2. Character 3-grams of significant stem tokens for morphological similarity
    if (stem.length >= 3) {
      for (let i = 0; i <= stem.length - 3; i++) {
        const ngram = stem.slice(i, i + 3);
        const nhash = crypto.createHash('md5').update(ngram).digest();
        const nbucket = nhash.readUInt16BE(0) % EMBEDDING_DIMENSION;
        vector[nbucket] += 0.4;
      }
    }
  }

  return l2Normalize(vector);
}

/**
 * Generates an embedding vector with complete provider and dimensionality metadata.
 * Ensures consistent retrieval space and prevents cross-space dimension corruption.
 */
export async function generateEmbeddingWithMeta(
  text: string,
  preferredProvider?: 'local' | 'google-genai'
): Promise<EmbeddingMetadata> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const wantCloud = preferredProvider === 'google-genai' || (process.env.USE_CLOUD_EMBEDDINGS === 'true' && preferredProvider !== 'local');

  if (wantCloud && apiKey && apiKey.trim() !== '') {
    try {
      const { ai } = await import('../genkit');
      const { textEmbedding004 } = await import('@genkit-ai/googleai');
      const result = await ai.embed({
        embedder: textEmbedding004,
        content: text,
      });
      if (result && Array.isArray(result) && result.length > 0) {
        const rawVec = (result[0] as any)?.embedding || result[0];
        if (Array.isArray(rawVec)) {
          const normalized = l2Normalize(rawVec as number[]);
          return {
            embedding: normalized,
            provider: 'google-genai',
            model: CLOUD_EMBEDDING_MODEL,
            dimension: normalized.length || CLOUD_EMBEDDING_DIMENSION,
          };
        }
      }
    } catch (cloudErr) {
      if (preferredProvider === 'google-genai') {
        throw new Error(`Cloud embedding generation failed: ${cloudErr instanceof Error ? cloudErr.message : String(cloudErr)}`);
      }
      console.warn('Cloud embedding attempt failed, falling back to local semantic vectorizer:', cloudErr);
    }
  }

  const localVec = generateLocalEmbedding(text);
  return {
    embedding: localVec,
    provider: 'local',
    model: LOCAL_EMBEDDING_MODEL,
    dimension: LOCAL_EMBEDDING_DIMENSION,
  };
}

/**
 * Primary embedding dispatcher.
 * Returns normalized vector array for backwards compatibility.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const meta = await generateEmbeddingWithMeta(text);
  return meta.embedding;
}
