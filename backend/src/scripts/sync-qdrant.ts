import 'dotenv/config';
import { prisma } from '../db';
import * as aiService from '../modules/ai/ai.service';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function syncPostgresToQdrant() {
  console.log('🚀 Start syncing data from PostgreSQL to Qdrant...');

  // 1. Create collection if not exists
  await aiService.initQdrant();

  // 2. Get all AVAILABLE products from Postgres
  const products = await prisma.product.findMany({
    where: { status: 'AVAILABLE' },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  });

  console.log(`📦 Found ${products.length} products to sync.`);

  if (!products.length) {
    console.log('⚠️  No products to sync.');
    return;
  }

  // 3. Upsert each product, wait 500ms between each to avoid Gemini rate limit
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
      process.stdout.write(`\r⏳ Processing: ${i + 1}/${products.length} (✓ ${successCount} | ✗ ${errorCount})`);
      await delay(500);
    } catch (err) {
      errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`\n❌ Product ID ${product.id} error: ${msg}\n`);
    }
  }

  console.log('\n');
  console.log('✅ Sync completed!');
  console.log(`📊 Success: ${successCount} | Failure: ${errorCount}`);
}

// Run independently: npx ts-node src/scripts/sync-qdrant.ts
if (require.main === module) {
  syncPostgresToQdrant()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
