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
import { generateEmbedding } from './embeddings';
import {
  saveChunks,
  searchSimilar,
  deleteDocumentChunks,
  listUserDocuments,
  ChunkRecord,
  DocumentSummary,
} from './vector-store';
import { executeTextGeneration } from '../provider';

export interface IngestDocumentInput {
  documentId?: string;
  title: string;
  content: string;
  userId: string;
  tags?: string[];
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

  // Embed all chunks
  const chunkRecords: ChunkRecord[] = [];
  let totalTokens = 0;

  for (const rc of rawChunks) {
    totalTokens += rc.tokenCount;
    const embedding = await generateEmbedding(rc.content);
    chunkRecords.push({
      userId,
      documentId,
      title,
      chunkIndex: rc.chunkIndex,
      totalChunks: rc.totalChunks,
      content: rc.content,
      tokenCount: rc.tokenCount,
      embedding,
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
  topK: number = 3
): Promise<{ citations: Citation[]; contextText: string }> {
  const trimmedQuery = (query || '').trim();
  const trimmedUserId = (userId || '').trim();

  if (!trimmedUserId) {
    throw new Error('Tenant Violation: Authenticated user ID is required for retrieval');
  }
  if (!trimmedQuery) {
    return { citations: [], contextText: '' };
  }

  const queryEmbedding = await generateEmbedding(trimmedQuery);
  const searchResults = await searchSimilar(queryEmbedding, trimmedUserId, topK);

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
}): Promise<RAGQueryOutput> {
  const { question, userId, language = 'English', topK = 3 } = input;

  const { citations, contextText } = await retrieveContext(question, userId, topK);

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
