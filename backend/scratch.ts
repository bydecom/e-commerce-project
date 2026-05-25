import { prisma } from './src/db';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: '2401', mode: 'insensitive' } },
        { name: { contains: '2401', mode: 'insensitive' } }
      ]
    },
    select: { id: true, email: true, name: true }
  });
  console.log('Users found:', users.length);
  console.log(users);

  const order2401 = await prisma.order.findUnique({
    where: { id: 2401 },
    select: { id: true, userId: true, user: { select: { email: true, name: true } } }
  });
  console.log('Order 2401:', order2401);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
