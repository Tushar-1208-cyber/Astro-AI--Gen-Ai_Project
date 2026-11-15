/**
 * ============================================================================
 * ASTRO AI — RETRIEVAL AUGMENTED GENERATION (RAG) ENGINE
 * ============================================================================
 * 
 * End-to-end RAG pipeline providing document ingestion, semantic chunking,
 * tenant-isolated vector indexing, citation-backed retrieval, and grounded AI generation.
 */

import crypto from 'crypto';
import { chunkDocument } from './document-chunker';
import {
  generateEmbedding,
  generateEmbeddingWithMeta,
  validateEmbeddingMatch,
  EmbeddingMetadata,
  EmbeddingDimensionMismatchError,
} from './embeddings';
import {
  saveChunks,
  searchSimilar,
  deleteDocumentChunks,
  listUserDocuments,
  ChunkRecord,
  DocumentSummary,
} from './vector-store';
import DocumentChunk, { IDocumentChunk } from '@/models/DocumentChunk';
import dbConnect from '@/lib/db';
import { executeTextGeneration } from '../provider';

export interface IngestDocumentInput {
  documentId?: string;
  title: string;
  content: string;
  userId: string;
  tags?: string[];
  preferredProvider?: 'local' | 'google-genai';
}

export interface IngestDocumentOutput {
  success: boolean;
  documentId: string;
  title: string;
  chunkCount: number;
  totalTokens: number;
}

export interface Citation {
  documentId: string;
  title: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface RAGQueryOutput {
  answer: string;
  citations: Citation[];
  contextFound: boolean;
}

/**
 * Ingests and indexes an educational document or classroom material for a specific user.
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<IngestDocumentOutput> {
  const userId = (input.userId || '').trim();
  const title = (input.title || '').trim();
  const content = (input.content || '').trim();

  if (!userId) {
    throw new Error('Tenant Violation: Authenticated user ID is required to ingest document');
  }
  if (!title) {
    throw new Error('Invalid Document: Title cannot be empty');
  }
  if (!content) {
    throw new Error('Invalid Document: Content cannot be empty');
  }

  const documentId = input.documentId?.trim() || `doc_${crypto.randomUUID()}`;
  const rawChunks = chunkDocument(content);

  if (rawChunks.length === 0) {
    throw new Error('Document Chunking Failed: Document produced 0 chunks');
  }

  // Embed all chunks with provider metadata and dimension validation
  const chunkRecords: ChunkRecord[] = [];
  let totalTokens = 0;

  for (const rc of rawChunks) {
    totalTokens += rc.tokenCount;
    const meta = await generateEmbeddingWithMeta(rc.content, input.preferredProvider);
    chunkRecords.push({
      userId,
      documentId,
      title,
      chunkIndex: rc.chunkIndex,
      totalChunks: rc.totalChunks,
      content: rc.content,
      tokenCount: rc.tokenCount,
      embedding: meta.embedding,
      embeddingProvider: meta.provider,
      embeddingModel: meta.model,
      embeddingDimension: meta.dimension,
      tags: input.tags || [],
    });
  }

  await saveChunks(chunkRecords);

  return {
    success: true,
    documentId,
    title,
    chunkCount: chunkRecords.length,
    totalTokens,
  };
}

/**
 * Retrieves the most relevant document chunks for a query, isolated to the authenticated user.
 */
export async function retrieveContext(
  query: string,
  userId: string,
  topKOrOptions: number | { topK?: number; preferredProvider?: 'local' | 'google-genai' } = 3
): Promise<{ citations: Citation[]; contextText: string }> {
  const trimmedQuery = (query || '').trim();
  const trimmedUserId = (userId || '').trim();

  if (!trimmedUserId) {
    throw new Error('Tenant Violation: Authenticated user ID is required for retrieval');
  }
  if (!trimmedQuery) {
    return { citations: [], contextText: '' };
  }

  const options =
    typeof topKOrOptions === 'number'
      ? { topK: topKOrOptions }
      : topKOrOptions;

  const topK = options.topK ?? 3;
  const queryMeta = await generateEmbeddingWithMeta(trimmedQuery, options.preferredProvider);

  // Scalable search with dimension and provider isolation:
  const searchResults = await searchSimilar(queryMeta.embedding, trimmedUserId, {
    topK,
    embeddingDimension: queryMeta.dimension,
    embeddingProvider: queryMeta.provider,
  });

  const citations: Citation[] = searchResults.map((r) => ({
    documentId: r.documentId,
    title: r.title,
    chunkIndex: r.chunkIndex,
    score: r.score,
    excerpt: r.content.slice(0, 160) + (r.content.length > 160 ? '...' : ''),
  }));

  const contextSegments = searchResults.map(
    (r, idx) => `[Source ${idx + 1}: ${r.title}]\n${r.content}`
  );

  return {
    citations,
    contextText: contextSegments.join('\n\n'),
  };
}

/**
 * Grounded educational Q&A powered by tenant-isolated RAG.
 */
export async function askWithRAG(input: {
  question: string;
  userId: string;
  language?: string;
  topK?: number;
  preferredProvider?: 'local' | 'google-genai';
}): Promise<RAGQueryOutput> {
  const { question, userId, language = 'English', topK = 3, preferredProvider } = input;

  const { citations, contextText } = await retrieveContext(question, userId, {
    topK,
    preferredProvider,
  });

  if (!contextText || citations.length === 0) {
    // No relevant documents found: generate without context and notify
    const directPrompt = `<|im_start|>system
You are Astro, a knowledgeable educational assistant.
Answer the following question clearly in ${language}.<|im_end|>
<|im_start|>user
${question}<|im_end|>
<|im_start|>assistant
`;

    const answer = await executeTextGeneration({
      prompt: directPrompt,
      maxTokens: 1024,
      temperature: 0.7,
      capability: 'text-generation',
    });

    return {
      answer: answer.trim(),
      citations: [],
      contextFound: false,
    };
  }

  // Grounded prompt with explicit citations
  const prompt = `<|im_start|>system
You are Astro, a classroom AI assistant.
Use the following verified textbook/notes context to answer the user's question.
Always ground your answers in the provided context and reference sources where applicable.
Respond in ${language}.

Context Materials:
${contextText}<|im_end|>
<|im_start|>user
${question}<|im_end|>
<|im_start|>assistant
`;

  const answer = await executeTextGeneration({
    prompt,
    maxTokens: 1024,
    temperature: 0.5,
    capability: 'text-generation',
  });

  return {
    answer: answer.trim(),
    citations,
    contextFound: true,
  };
}

/**
 * Deletes a document and its vector chunks for the user
 */
export async function removeDocument(
  documentId: string,
  userId: string
): Promise<{ success: boolean; deletedCount: number }> {
  const result = await deleteDocumentChunks(documentId, userId);
  return {
    success: true,
    deletedCount: result.deletedCount,
  };
}

/**
 * Lists all documents ingested by the authenticated user
 */
export async function getUserDocuments(userId: string): Promise<DocumentSummary[]> {
  return listUserDocuments(userId);
}

export interface ReindexOptions {
  batchSize?: number;
  forceReindexAll?: boolean;
}

export interface ReindexOutput {
  reindexedChunks: number;
  totalChunks: number;
  targetDimension: number;
  provider: string;
}

/**
 * Scalably re-indexes document chunks for a tenant into a target embedding provider space.
 * Uses bounded batch processing (default batchSize: 50) to prevent memory exhaustion on large collections.
 * Preserves strict tenant isolation scoped to the authenticated user ID.
 * Guarantees zero data loss on midway interruption and supports idempotent recovery.
 */
export async function reindexUserDocuments(
  userId: string,
  targetProvider: 'local' | 'google-genai' = 'local',
  options?: ReindexOptions
): Promise<ReindexOutput> {
  const trimmedUserId = (userId || '').trim();
  if (!trimmedUserId) {
    throw new Error('Tenant Violation: Authenticated user ID is required for re-indexing');
  }

  await dbConnect();

  const batchSize = Math.max(1, Math.min(options?.batchSize || 50, 500));
  const forceAll = options?.forceReindexAll ?? false;
  const targetDimension = targetProvider === 'local' ? 384 : 768;

  // Total chunks belonging to this tenant
  const totalChunks = await DocumentChunk.countDocuments({ userId: trimmedUserId });
  if (totalChunks === 0) {
    return {
      reindexedChunks: 0,
      totalChunks: 0,
      targetDimension,
      provider: targetProvider,
    };
  }

  // Idempotent query: find chunks that still need migration to target provider/dimension
  const filter: Record<string, any> = { userId: trimmedUserId };
  if (!forceAll) {
    filter.$or = [
      { embeddingProvider: { $ne: targetProvider } },
      { embeddingDimension: { $ne: targetDimension } },
    ];
  }

  let reindexedCount = 0;
  let lastSeenId: any = null;
  let hasMore = true;

  // Process in bounded batches using keyset pagination: each batch is fetched, embedded, validated, and updated
  while (hasMore) {
    const query: Record<string, any> = { ...filter };
    if (lastSeenId) {
      query._id = { $gt: lastSeenId };
    }

    const batch = await DocumentChunk.find(query)
      .sort({ _id: 1 })
      .limit(batchSize)
      .exec();

    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    lastSeenId = batch[batch.length - 1]._id;

    const bulkOps = [];
    for (const chunk of batch) {
      // Generate new embedding for target provider (throws and halts safely if provider fails)
      const meta = await generateEmbeddingWithMeta(chunk.content, targetProvider);

      bulkOps.push({
        updateOne: {
          filter: {
            _id: chunk._id,
            userId: trimmedUserId, // Strict tenant isolation in update filter
          },
          update: {
            $set: {
              embedding: meta.embedding,
              embeddingProvider: meta.provider,
              embeddingModel: meta.model,
              embeddingDimension: meta.dimension,
            },
          },
        },
      });
    }

    if (bulkOps.length > 0) {
      const res = await DocumentChunk.bulkWrite(bulkOps);
      const modified = (res.modifiedCount || 0) + (res.upsertedCount || 0);
      reindexedCount += modified;
    }

    // If batch was smaller than batchSize, we processed the last batch
    if (batch.length < batchSize) {
      hasMore = false;
    }
  }

  return {
    reindexedChunks: reindexedCount,
    totalChunks,
    targetDimension,
    provider: targetProvider,
  };
}
