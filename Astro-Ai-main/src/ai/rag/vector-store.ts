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
import { cosineSimilarity } from './embeddings';

export interface ChunkRecord {
  userId: string;
  documentId: string;
  title: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  tags?: string[];
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

  // Validate that all chunks have a userId
  for (const c of chunks) {
    if (!c.userId || c.userId.trim() === '') {
      throw new Error('Tenant Violation: Cannot save document chunk without authenticated userId');
    }
  }

  const operations = chunks.map((chunk) => ({
    updateOne: {
      filter: {
        userId: chunk.userId,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
      },
      update: { $set: chunk },
      upsert: true,
    },
  }));

  const result = await DocumentChunk.bulkWrite(operations);
  return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

/**
 * Performs cosine similarity search across the authenticated user's document chunks only.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  userId: string,
  topK: number = 3,
  minScore: number = 0.15
): Promise<SearchResult[]> {
  if (!userId || userId.trim() === '') {
    throw new Error('Tenant Violation: User ID is required to query vector store');
  }

  await dbConnect();

  // Strictly filter by userId to guarantee tenant isolation
  const chunks = await DocumentChunk.find({ userId: userId.trim() })
    .select('documentId title chunkIndex content embedding')
    .lean<IDocumentChunk[]>();

  if (!chunks || chunks.length === 0) {
    return [];
  }

  const scored: SearchResult[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (score >= minScore) {
      scored.push({
        documentId: chunk.documentId,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: Math.round(score * 1000) / 1000,
      });
    }
  }

  // Sort descending by similarity score and take topK
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
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
