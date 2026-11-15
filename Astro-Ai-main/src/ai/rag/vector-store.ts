/**
 * ============================================================================
 * ASTRO AI — MULTI-TENANT VECTOR STORE
 * ============================================================================
 * 
 * Provides vector persistence, indexing, similarity search, and document management.
 * Enforces strict multi-tenant isolation at the database layer (User A can never see User B's documents).
 */

import dbConnect from '@/lib/db';
import DocumentChunk, { IDocumentChunk } from '@/models/DocumentChunk';
import { cosineSimilarity, validateVector } from './embeddings';

export interface ChunkRecord {
  userId: string;
  documentId: string;
  title: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  tags?: string[];
}

export interface SearchSimilarOptions {
  topK?: number;
  minScore?: number;
  maxCandidates?: number;
  embeddingProvider?: string;
  embeddingDimension?: number;
}

export interface SearchResult {
  documentId: string;
  title: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface DocumentSummary {
  documentId: string;
  title: string;
  chunkCount: number;
  totalTokens: number;
  createdAt: Date;
}

/**
 * Persists document chunks into the tenant-isolated MongoDB store
 */
export async function saveChunks(chunks: ChunkRecord[]): Promise<number> {
  if (!chunks || chunks.length === 0) {
    return 0;
  }

  await dbConnect();

  // Validate that all chunks have a userId and valid embedding vector before persistence
  for (const c of chunks) {
    if (!c.userId || c.userId.trim() === '') {
      throw new Error('Tenant Violation: Cannot save document chunk without authenticated userId');
    }
    const dimension = c.embeddingDimension || c.embedding?.length || 384;
    validateVector(c.embedding, dimension);
  }

  const operations = chunks.map((chunk) => {
    const dimension = chunk.embeddingDimension || chunk.embedding?.length || 384;
    const provider = chunk.embeddingProvider || 'local';
    const model = chunk.embeddingModel || (provider === 'local' ? 'deterministic-ngram-384' : 'text-embedding-004');
    const now = new Date();

    return {
      updateOne: {
        filter: {
          userId: chunk.userId,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
        },
        update: {
          $set: {
            ...chunk,
            embeddingDimension: dimension,
            embeddingProvider: provider,
            embeddingModel: model,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
      },
    };
  });

  const result = await DocumentChunk.bulkWrite(operations);
  return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

/**
 * Performs scalable, tenant-isolated vector similarity search.
 * Bounded by candidate scan limits, matching embedding dimensions, and top-K heap sorting.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  userId: string,
  topKOrOptions: number | SearchSimilarOptions = 3,
  minScoreParam: number = 0.15
): Promise<SearchResult[]> {
  if (!userId || userId.trim() === '') {
    throw new Error('Tenant Violation: User ID is required to query vector store');
  }

  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  const options: SearchSimilarOptions =
    typeof topKOrOptions === 'number'
      ? { topK: topKOrOptions, minScore: minScoreParam }
      : topKOrOptions;

  const topK = options.topK ?? 3;
  const minScore = options.minScore ?? 0.15;
  const maxCandidates = options.maxCandidates ?? 1000;
  const targetDimension = options.embeddingDimension ?? queryEmbedding.length;

  await dbConnect();

  // Query filter strictly scoped to the tenant AND matching embedding dimension
  const queryFilter: Record<string, any> = {
    userId: userId.trim(),
    embeddingDimension: targetDimension,
  };

  if (options.embeddingProvider) {
    queryFilter.embeddingProvider = options.embeddingProvider;
  }

  // Scalable projection: limit scanned candidates and sort by newest first
  const chunks = await DocumentChunk.find(queryFilter)
    .select('documentId title chunkIndex content embedding embeddingDimension embeddingProvider')
    .sort({ createdAt: -1 })
    .limit(maxCandidates)
    .lean<IDocumentChunk[]>();

  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Bounded Top-K selection (keeps memory bounded to O(topK))
  const topResults: SearchResult[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length !== queryEmbedding.length) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (score < minScore) {
      continue;
    }

    const candidate: SearchResult = {
      documentId: chunk.documentId,
      title: chunk.title,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: Math.round(score * 1000) / 1000,
    };

    // Insert sorted
    const insertIdx = topResults.findIndex((r) => r.score < candidate.score);
    if (insertIdx === -1) {
      if (topResults.length < topK) {
        topResults.push(candidate);
      }
    } else {
      topResults.splice(insertIdx, 0, candidate);
      if (topResults.length > topK) {
        topResults.pop();
      }
    }
  }

  return topResults;
}

/**
 * Deletes all chunks associated with a document ID for the authenticated user.
 */
export async function deleteDocumentChunks(
  documentId: string,
  userId: string
): Promise<{ deletedCount: number }> {
  if (!userId || userId.trim() === '') {
    throw new Error('Tenant Violation: User ID is required to delete document chunks');
  }

  await dbConnect();

  const res = await DocumentChunk.deleteMany({
    userId: userId.trim(),
    documentId: documentId.trim(),
  });

  return { deletedCount: res.deletedCount || 0 };
}

/**
 * Returns a summary list of all distinct documents owned by the user.
 */
export async function listUserDocuments(userId: string): Promise<DocumentSummary[]> {
  if (!userId || userId.trim() === '') {
    return [];
  }

  await dbConnect();

  const aggregated = await DocumentChunk.aggregate([
    { $match: { userId: userId.trim() } },
    {
      $group: {
        _id: '$documentId',
        title: { $first: '$title' },
        chunkCount: { $sum: 1 },
        totalTokens: { $sum: '$tokenCount' },
        createdAt: { $min: '$createdAt' },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return aggregated.map((item) => ({
    documentId: item._id,
    title: item.title,
    chunkCount: item.chunkCount,
    totalTokens: item.totalTokens,
    createdAt: item.createdAt,
  }));
}
