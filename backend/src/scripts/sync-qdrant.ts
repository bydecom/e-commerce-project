import 'dotenv/config';
import { prisma } from '../db';
import * as aiService from '../modules/ai/ai.service';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function syncPostgresToQdrant() {
  console.log('🚀 Bắt đầu đồng bộ dữ liệu từ PostgreSQL sang Qdrant...');

  // 1. Tạo collection nếu chưa có
  await aiService.initQdrant();

  // 2. Lấy tất cả sản phẩm AVAILABLE từ Postgres
  const products = await prisma.product.findMany({
    where: { status: 'AVAILABLE' },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  });

  console.log(`📦 Tìm thấy ${products.length} sản phẩm cần đồng bộ.`);

  if (!products.length) {
    console.log('⚠️  Không có sản phẩm nào để đồng bộ.');
    return;
  }

  // 3. Upsert từng sản phẩm, chờ 500ms giữa mỗi lần để tránh Gemini rate limit
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    try {
      await aiService.upsertProductVector({
        id: product.id,
        name: product.name,
        description: product.description,
        categoryName: product.category?.name ?? null,
      });
      successCount++;
      process.stdout.write(`\r⏳ Đang xử lý: ${i + 1}/${products.length} (✓ ${successCount} | ✗ ${errorCount})`);
      await delay(500);
    } catch (err) {
      errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`\n❌ Lỗi sản phẩm ID ${product.id}: ${msg}\n`);
    }
  }

  console.log('\n');
  console.log('✅ Đồng bộ hoàn tất!');
  console.log(`📊 Thành công: ${successCount} | Thất bại: ${errorCount}`);
}

// Chạy độc lập: npx ts-node src/scripts/sync-qdrant.ts
if (require.main === module) {
  syncPostgresToQdrant()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
