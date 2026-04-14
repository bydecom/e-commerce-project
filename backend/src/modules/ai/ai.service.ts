import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = 'products';
const VECTOR_SIZE = 768; // dùng outputDimensionality 768
const EMBEDDING_MODEL = 'gemini-embedding-001';

function getQdrantClient(): QdrantClient {
  return new QdrantClient({ url: process.env.QDRANT_URL ?? 'http://localhost:6333' });
}

function l2Normalize(values: number[]): number[] {
  let sumSq = 0;
  for (const v of values) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (!norm) return values;
  return values.map((v) => v / norm);
}

async function generateEmbedding(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { taskType, outputDimensionality: VECTOR_SIZE },
  });

  const raw = (result.embeddings?.[0]?.values as number[] | undefined) ?? [];
  return raw.length ? l2Normalize(raw) : [];
}

/**
 * Tạo Qdrant collection nếu chưa tồn tại.
 * Gọi một lần trước khi upsert hàng loạt.
 */
export async function initQdrant(): Promise<void> {
  const qdrant = getQdrantClient();
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    console.log(`✅ Qdrant: collection "${COLLECTION_NAME}" đã được tạo.`);
  } else {
    console.log(`ℹ️  Qdrant: collection "${COLLECTION_NAME}" đã tồn tại.`);
  }
}

/**
 * Sinh embedding và upsert một sản phẩm vào Qdrant.
 * Ném lỗi nếu Gemini không trả về vector (để sync script biết đếm lỗi).
 */
export async function upsertProductVector(product: {
  id: number;
  name: string;
  description: string | null;
  categoryName?: string | null;
}): Promise<void> {
  const text = [
    product.name,
    product.categoryName ? `Category: ${product.categoryName}` : null,
    product.description,
  ]
    .filter(Boolean)
    .join(' — ');
  const vector = await generateEmbedding(text, 'RETRIEVAL_DOCUMENT');

  if (!vector.length) {
    throw new Error(`Không thể sinh embedding cho sản phẩm ID ${product.id}`);
  }

  const qdrant = getQdrantClient();
  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{ id: product.id, vector }],
  });
}

export async function deleteProductVector(productId: number): Promise<void> {
  const qdrant = getQdrantClient();
  await qdrant.delete(COLLECTION_NAME, {
    wait: true,
    points: [productId],
  });
}

/**
 * Tìm kiếm vector trong Qdrant theo keyword.
 * Trả về [] nếu Qdrant chưa chạy, collection chưa tồn tại, hoặc Gemini chưa cấu hình.
 */
export async function searchVectors(keyword: string, limit: number): Promise<{ id: number }[]> {
  try {
    const vector = await generateEmbedding(keyword, 'RETRIEVAL_QUERY');
    if (!vector.length) return [];

    const qdrant = getQdrantClient();
    const results = await qdrant.search(COLLECTION_NAME, {
      vector,
      limit,
      with_payload: false,
    });

    return results
      .filter((r) => typeof r.id === 'number')
      .map((r) => ({ id: r.id as number }));
  } catch {
    return [];
  }
}
