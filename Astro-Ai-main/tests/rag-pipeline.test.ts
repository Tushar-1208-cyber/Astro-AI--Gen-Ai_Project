/**
 * ============================================================================
 * ASTRO AI — RETRIEVAL AUGMENTED GENERATION (RAG) PIPELINE TEST SUITE
 * ============================================================================
 * 
 * Verifies document ingestion, chunking, embedding generation, cosine similarity ranking,
 * citation formation, multi-tenant isolation, grounded Q&A generation, and document lifecycle.
 */

import dbConnect from '../src/lib/db';
import DocumentChunk from '../src/models/DocumentChunk';
import { chunkDocument, estimateTokenCount } from '../src/ai/rag/document-chunker';
import { generateEmbedding, cosineSimilarity } from '../src/ai/rag/embeddings';
import {
  saveChunks,
  searchSimilar,
  deleteDocumentChunks,
  listUserDocuments,
} from '../src/ai/rag/vector-store';
import {
  ingestDocument,
  retrieveContext,
  askWithRAG,
  removeDocument,
  getUserDocuments,
} from '../src/ai/rag/rag-engine';

interface TestResult {
  id: string;
  description: string;
  passed: boolean;
  error?: string;
  detail?: string;
}

const results: TestResult[] = [];

async function runTest(
  id: string,
  description: string,
  fn: () => Promise<string | void>
) {
  process.stdout.write(`⏳ Running [${id}] ${description}... `);
  try {
    const detail = await fn();
    results.push({ id, description, passed: true, detail: detail || 'OK' });
    console.log(`PASS ${detail ? `(${detail})` : ''}`);
  } catch (err: any) {
    results.push({ id, description, passed: false, error: err.message });
    console.log(`FAIL\n   ❌ Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING ASTRO AI RAG PIPELINE & RETRIEVAL SUITE');
  console.log('======================================================\n');

  await dbConnect();

  const userA = `teacher_rag_a_${Date.now()}`;
  const userB = `teacher_rag_b_${Date.now()}`;

  // Cleanup any potential leftovers for test users
  await DocumentChunk.deleteMany({ userId: { $in: [userA, userB] } });

  // TEST 1: Document Chunker preserves paragraph boundaries and computes token counts
  await runTest('RAG-01', 'Document chunker splits text with overlapping boundaries', async () => {
    const sampleText = `
Photosynthesis is the process by which green plants and certain other organisms use sunlight to synthesize foods with the aid of chlorophyll.
This vital biological process converts carbon dioxide and water into glucose and oxygen.

Chloroplasts are the primary organelles in plant cells where photosynthesis occurs.
Inside chloroplasts, thylakoid membranes contain chlorophyll pigments that absorb blue and red light while reflecting green.

During the light-dependent reactions, sunlight energizes electrons in chlorophyll, generating ATP and NADPH.
In the light-independent reactions (Calvin cycle), these chemical energy carriers are used to convert carbon dioxide into sugars.
    `.trim();

    const chunks = chunkDocument(sampleText, { maxChunkSize: 250, chunkOverlap: 50 });
    if (chunks.length < 2) {
      throw new Error(`Expected at least 2 chunks, got ${chunks.length}`);
    }
    for (const c of chunks) {
      if (!c.content || c.content.length === 0) throw new Error('Empty chunk content generated');
      if (c.tokenCount <= 0) throw new Error('Invalid token count');
      if (c.totalChunks !== chunks.length) throw new Error('Total chunks mismatch');
    }
    return `${chunks.length} chunks produced, first chunk tokens: ${chunks[0].tokenCount}`;
  });

  // TEST 2: Deterministic embeddings generate valid unit-norm vectors with semantic similarity
  await runTest('RAG-02', 'Semantic embeddings produce high similarity for related topics', async () => {
    const emb1 = await generateEmbedding('Photosynthesis converts sunlight into plant glucose and oxygen');
    const emb2 = await generateEmbedding('Plants synthesize chlorophyll foods using solar radiation');
    const emb3 = await generateEmbedding('Ancient Roman architecture used concrete arches and aqueducts');

    if (emb1.length === 0 || emb2.length === 0 || emb3.length === 0) {
      throw new Error('Embeddings returned empty arrays');
    }

    const simRelated = cosineSimilarity(emb1, emb2);
    const simUnrelated = cosineSimilarity(emb1, emb3);

    if (simRelated <= simUnrelated) {
      throw new Error(
        `Related similarity (${simRelated.toFixed(3)}) should exceed unrelated similarity (${simUnrelated.toFixed(3)})`
      );
    }
    return `Related: ${simRelated.toFixed(3)}, Unrelated: ${simUnrelated.toFixed(3)}`;
  });

  // TEST 3: Ingest educational document for User A
  let docA1Id = '';
  await runTest('RAG-03', 'Ingest educational document and persist vector chunks for User A', async () => {
    const doc = await ingestDocument({
      userId: userA,
      title: 'Grade 8 Science: Cell Biology & Energy',
      content: `
Mitochondria are known as the powerhouses of the cell. They generate most of the chemical energy needed to power the cell's biochemical reactions.
Chemical energy produced by the mitochondria is stored in a small molecule called adenosine triphosphate (ATP).

Cellular respiration involves glycolysis in the cytoplasm followed by the citric acid cycle and oxidative phosphorylation inside mitochondria.
Glucose is broken down to produce approximately 36 to 38 molecules of ATP per glucose molecule in aerobic conditions.
      `.trim(),
      tags: ['biology', 'grade-8', 'science'],
    });

    if (!doc.success || !doc.documentId) {
      throw new Error('Document ingestion reported failure');
    }
    docA1Id = doc.documentId;
    const dbCount = await DocumentChunk.countDocuments({ userId: userA, documentId: docA1Id });
    if (dbCount === 0) {
      throw new Error('No chunks found in MongoDB for ingested document');
    }
    return `Document ID: ${docA1Id}, Chunks in DB: ${dbCount}`;
  });

  // TEST 4: Ingest a distinct document for User B (Tenant Isolation Setup)
  let docB1Id = '';
  await runTest('RAG-04', 'Ingest distinct document for User B', async () => {
    const doc = await ingestDocument({
      userId: userB,
      title: 'World History: Renaissance Art',
      content: `
The Renaissance was a fervent period of European cultural, artistic, political and economic rebirth following the Middle Ages.
Leonardo da Vinci and Michelangelo were central figures who pioneered perspective and human anatomy in art.
      `.trim(),
      tags: ['history', 'renaissance'],
    });

    if (!doc.success) throw new Error('User B ingestion failed');
    docB1Id = doc.documentId;
    return `User B Document ID: ${docB1Id}`;
  });

  // TEST 5: User A retrieves relevant context with citations from their own document
  await runTest('RAG-05', 'Retrieve context with citations for User A', async () => {
    const { citations, contextText } = await retrieveContext(
      'How is ATP produced in mitochondria during cellular respiration?',
      userA,
      2
    );

    if (citations.length === 0) {
      throw new Error('Expected citations for relevant query, got none');
    }
    if (!contextText.includes('ATP') && !contextText.includes('mitochondria')) {
      throw new Error('Retrieved context does not contain query keywords');
    }
    if (citations[0].documentId !== docA1Id) {
      throw new Error(`Expected citation to reference doc ${docA1Id}, got ${citations[0].documentId}`);
    }
    return `Top citation: "${citations[0].title}" (score: ${citations[0].score})`;
  });

  // TEST 6: Strict Multi-Tenant Isolation (User A cannot retrieve User B's documents)
  await runTest('RAG-06', 'Tenant Isolation: User A cannot retrieve User B documents even with exact query', async () => {
    const { citations } = await retrieveContext(
      'Leonardo da Vinci and Michelangelo Renaissance art',
      userA, // Querying as User A
      3
    );

    // Any citation returned MUST belong to userA, never docB1Id
    const leakedUserBDoc = citations.find((c) => c.documentId === docB1Id);
    if (leakedUserBDoc) {
      throw new Error(`CRITICAL TENANT VIOLATION: User A retrieved User B document: ${docB1Id}`);
    }
    return `Zero leaked documents from User B`;
  });

  // TEST 7: Tenant Isolation: User B cannot retrieve User A's documents
  await runTest('RAG-07', 'Tenant Isolation: User B cannot retrieve User A documents', async () => {
    const { citations } = await retrieveContext(
      'mitochondria powerhouse ATP cellular respiration',
      userB, // Querying as User B
      3
    );

    const leakedUserADoc = citations.find((c) => c.documentId === docA1Id);
    if (leakedUserADoc) {
      throw new Error(`CRITICAL TENANT VIOLATION: User B retrieved User A document: ${docA1Id}`);
    }
    return `Zero leaked documents from User A`;
  });

  // TEST 8: Document summary listing respects tenant boundaries
  await runTest('RAG-08', 'Document listing returns only documents owned by the authenticated tenant', async () => {
    const docsA = await getUserDocuments(userA);
    const docsB = await getUserDocuments(userB);

    if (docsA.length === 0 || !docsA.some((d) => d.documentId === docA1Id)) {
      throw new Error("User A documents missing docA1Id");
    }
    if (docsA.some((d) => d.documentId === docB1Id)) {
      throw new Error("User A document list contains User B document");
    }
    if (docsB.some((d) => d.documentId === docA1Id)) {
      throw new Error("User B document list contains User A document");
    }
    return `User A count: ${docsA.length}, User B count: ${docsB.length}`;
  });

  // TEST 9: Grounded Q&A with citations via Local/Central AI Provider
  await runTest('RAG-09', 'Ground question-answering with citations and context validation', async () => {
    const result = await askWithRAG({
      question: 'What is the role of mitochondria in ATP production?',
      userId: userA,
      language: 'English',
      topK: 2,
    });

    if (!result.contextFound) {
      throw new Error('Expected contextFound: true for indexed topic');
    }
    if (result.citations.length === 0) {
      throw new Error('Expected citations list in RAG response');
    }
    if (!result.answer || result.answer.trim().length === 0) {
      throw new Error('Generated RAG answer was empty');
    }
    return `Citations: ${result.citations.length}, Answer length: ${result.answer.length} chars`;
  });

  // TEST 10: Fallback Q&A when no relevant documents exist (Graceful degradation)
  await runTest('RAG-10', 'Fallback Q&A executes smoothly when no documents match', async () => {
    const result = await askWithRAG({
      question: 'What is quantum entanglement?',
      userId: userB, // User B has art documents, not quantum physics
      language: 'English',
      topK: 2,
    });

    // Should return an answer without failing, with contextFound=false or fallback
    if (!result.answer || result.answer.trim().length === 0) {
      throw new Error('Expected non-empty fallback answer');
    }
    return `ContextFound: ${result.contextFound}, Answer length: ${result.answer.length} chars`;
  });

  // TEST 11: Document Deletion removes all chunks and enforces tenant boundary
  await runTest('RAG-11', 'Delete document cleans up vector chunks without affecting other users', async () => {
    const removeRes = await removeDocument(docA1Id, userA);
    if (!removeRes.success || removeRes.deletedCount === 0) {
      throw new Error(`Failed to delete document ${docA1Id}`);
    }

    const remainingA = await DocumentChunk.countDocuments({ userId: userA, documentId: docA1Id });
    if (remainingA !== 0) {
      throw new Error(`Chunks still exist for deleted document: ${remainingA}`);
    }

    // Verify User B's document was untouched
    const countB = await DocumentChunk.countDocuments({ userId: userB, documentId: docB1Id });
    if (countB === 0) {
      throw new Error("User B's document chunks were inadvertently affected");
    }
    return `Deleted User A chunks: ${removeRes.deletedCount}, User B chunks preserved: ${countB}`;
  });

  // TEST 12: Cross-tenant deletion attempt rejected
  await runTest('RAG-12', 'Cross-tenant deletion attempt fails to delete another user document', async () => {
    // User A attempts to delete User B's document
    const crossDelete = await removeDocument(docB1Id, userA);
    if (crossDelete.deletedCount !== 0) {
      throw new Error(`CRITICAL SECURITY FLAW: User A deleted User B document!`);
    }

    const bStillExists = await DocumentChunk.countDocuments({ userId: userB, documentId: docB1Id });
    if (bStillExists === 0) {
      throw new Error("User B document was destroyed during cross-tenant delete attempt");
    }
    return `Protected: 0 chunks deleted, User B chunks intact (${bStillExists})`;
  });

  // Cleanup test user data
  await DocumentChunk.deleteMany({ userId: { $in: [userA, userB] } });

  console.log('\n======================================================');
  console.log('📊 RAG PIPELINE & RETRIEVAL TEST SUMMARY');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total Executed: ${total}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} RAG TEST(S) FAILED!`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL ${total} RAG PIPELINE TESTS PASSED PERFECTLY!\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
