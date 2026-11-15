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

export interface EmbeddingOptions {
  preferredProvider?: 'local' | 'google-genai';
  allowFallback?: boolean;
}

export class EmbeddingDimensionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingDimensionMismatchError';
  }
}

export class CloudEmbeddingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudEmbeddingUnavailableError';
  }
}

export class MalformedEmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedEmbeddingError';
  }
}

/**
 * Validates that a vector is a non-empty array of finite numbers with the expected dimension
 */
export function validateVector(vec: number[], expectedDimension: number): void {
  if (!vec || !Array.isArray(vec)) {
    throw new MalformedEmbeddingError('Embedding vector must be a non-null array of numbers');
  }
  if (vec.length !== expectedDimension) {
    throw new EmbeddingDimensionMismatchError(
      `Vector dimension mismatch: expected ${expectedDimension}, got ${vec.length}`
    );
  }
  if (!vec.every((v) => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
    throw new MalformedEmbeddingError('Embedding vector contains NaN or non-finite values');
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
 * Making cloud-to-local fallback an explicit configuration choice (ALLOW_CLOUD_EMBEDDING_FALLBACK).
 */
export async function generateEmbeddingWithMeta(
  text: string,
  preferredProviderOrOptions?: 'local' | 'google-genai' | EmbeddingOptions
): Promise<EmbeddingMetadata> {
  const options: EmbeddingOptions =
    typeof preferredProviderOrOptions === 'string'
      ? { preferredProvider: preferredProviderOrOptions }
      : (preferredProviderOrOptions || {});

  const preferredProvider = options.preferredProvider;
  const allowFallback =
    options.allowFallback ?? (process.env.ALLOW_CLOUD_EMBEDDING_FALLBACK === 'true');

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const wantCloud =
    preferredProvider === 'google-genai' ||
    (process.env.USE_CLOUD_EMBEDDINGS === 'true' && preferredProvider !== 'local');

  if (wantCloud) {
    if (!apiKey || apiKey.trim() === '') {
      if (!allowFallback) {
        throw new CloudEmbeddingUnavailableError(
          'Cloud embedding requested ("google-genai" / USE_CLOUD_EMBEDDINGS=true), but no Google GenAI API key is configured. Cloud fallback is disabled.'
        );
      }
      console.warn(
        'Cloud embedding API key missing, but fallback explicitly allowed. Falling back to local semantic vectorizer.'
      );
    } else {
      try {
        const { ai } = await import('../genkit');
        const { textEmbedding004 } = await import('@genkit-ai/googleai');
        const result = await ai.embed({
          embedder: textEmbedding004,
          content: text,
        });

        if (!result || !Array.isArray(result) || result.length === 0) {
          throw new MalformedEmbeddingError('Cloud embedding returned empty or invalid response');
        }

        const rawVec = (result[0] as any)?.embedding || result[0];
        if (!Array.isArray(rawVec)) {
          throw new MalformedEmbeddingError('Cloud embedding response does not contain an embedding array');
        }

        if (rawVec.length !== CLOUD_EMBEDDING_DIMENSION) {
          throw new MalformedEmbeddingError(
            `Cloud embedding dimension mismatch: expected ${CLOUD_EMBEDDING_DIMENSION}, got ${rawVec.length}`
          );
        }

        if (!rawVec.every((v) => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
          throw new MalformedEmbeddingError('Cloud embedding contains non-numeric or non-finite values');
        }

        const normalized = l2Normalize(rawVec as number[]);
        validateVector(normalized, CLOUD_EMBEDDING_DIMENSION);

        return {
          embedding: normalized,
          provider: 'google-genai',
          model: CLOUD_EMBEDDING_MODEL,
          dimension: CLOUD_EMBEDDING_DIMENSION,
        };
      } catch (cloudErr) {
        if (!allowFallback) {
          if (
            cloudErr instanceof CloudEmbeddingUnavailableError ||
            cloudErr instanceof MalformedEmbeddingError ||
            cloudErr instanceof EmbeddingDimensionMismatchError
          ) {
            throw cloudErr;
          }
          throw new CloudEmbeddingUnavailableError(
            `Cloud embedding generation failed: ${cloudErr instanceof Error ? cloudErr.message : String(cloudErr)}`
          );
        }
        console.warn(
          'Cloud embedding attempt failed, but fallback explicitly enabled. Falling back to local semantic vectorizer:',
          cloudErr
        );
      }
    }
  }

  const localVec = generateLocalEmbedding(text);
  validateVector(localVec, LOCAL_EMBEDDING_DIMENSION);

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
