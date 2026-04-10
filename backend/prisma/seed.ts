import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home & kitchen',
  'Books & office',
  'Sports',
];

async function main(): Promise<void> {
  for (const name of DEFAULT_CATEGORIES) {
    const exists = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!exists) {
      await prisma.category.create({ data: { name } });
      console.log(`+ Category: ${name}`);
    } else {
      console.log(`= Category already exists: ${name}`);
    }
  }
  console.log('Category seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
