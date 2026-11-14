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

export const EMBEDDING_DIMENSION = 384;

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
 * Primary embedding dispatcher.
 * Uses local vectorizer by default for privacy, deterministic testing, and offline reliability.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && process.env.USE_CLOUD_EMBEDDINGS === 'true') {
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
          return l2Normalize(rawVec as number[]);
        }
      }
    } catch (cloudErr) {
      console.warn('Cloud embedding attempt failed, falling back to local semantic vectorizer:', cloudErr);
    }
  }

  return generateLocalEmbedding(text);
}
