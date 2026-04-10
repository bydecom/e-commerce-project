import { PrismaClient } from '@prisma/client';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding users, orders, and feedbacks...');

  // ── 1. Xóa dữ liệu cũ (tuân thủ thứ tự Foreign Key) ───────────────────────
  await prisma.feedback.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleared feedbacks, orderItems, orders, users.');

  // ── 2. Tạo users test ──────────────────────────────────────────────────────
  const [alice, bob, admin] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@test.com',
        password: 'hashed_password',
        name: 'Alice',
        phone: '0901111111',
        address: '123 Nguyen Hue, Q1, HCMC',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@test.com',
        password: 'hashed_password',
        name: 'Bob',
        phone: '0902222222',
        address: '456 Le Loi, Q1, HCMC',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: 'hashed_password',
        name: 'Admin',
        role: 'ADMIN',
      },
    }),
  ]);
  console.log(`✅ Created 3 users (alice id=${alice.id}, bob id=${bob.id}, admin id=${admin.id})`);

  // ── 3. Lấy một số product để gắn vào order ────────────────────────────────
  const products = await prisma.product.findMany({
    where: { status: 'AVAILABLE' },
    take: 10,
    orderBy: { id: 'asc' },
  });

  if (products.length < 5) {
    throw new Error('Cần chạy seed product trước! Không đủ 5 sản phẩm để test.');
  }

  const [p1, p2, p3, p4, p5] = products;

  // ── 4. Tạo orders ──────────────────────────────────────────────────────────
  async function createOrder(params: {
    userId: number;
    status: 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DONE' | 'CANCELLED';
    shippingAddress: string;
    lines: Array<{ productId: number; quantity: number; unitPrice: number }>;
  }) {
    const total = params.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return prisma.order.create({
      data: {
        userId: params.userId,
        status: params.status,
        total,
        shippingAddress: params.shippingAddress,
        items: {
          create: params.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
    });
  }

  // Alice — PENDING (có thể cancel hoặc confirm)
  const o1 = await createOrder({
    userId: alice.id,
    status: 'PENDING',
    shippingAddress: '123 Nguyen Hue, Q1, HCMC',
    lines: [
      { productId: p1.id, quantity: 2, unitPrice: p1.price },
      { productId: p2.id, quantity: 1, unitPrice: p2.price },
    ],
  });

  // Alice — CONFIRMED (admin đã xác nhận)
  const o2 = await createOrder({
    userId: alice.id,
    status: 'CONFIRMED',
    shippingAddress: '123 Nguyen Hue, Q1, HCMC',
    lines: [{ productId: p3.id, quantity: 1, unitPrice: p3.price }],
  });

  // Alice — SHIPPING (đang giao)
  const o3 = await createOrder({
    userId: alice.id,
    status: 'SHIPPING',
    shippingAddress: '123 Nguyen Hue, Q1, HCMC',
    lines: [
      { productId: p1.id, quantity: 1, unitPrice: p1.price },
      { productId: p4.id, quantity: 3, unitPrice: p4.price },
    ],
  });

  // Bob — DONE (hoàn thành)
  const o4 = await createOrder({
    userId: bob.id,
    status: 'DONE',
    shippingAddress: '456 Le Loi, Q1, HCMC',
    lines: [{ productId: p2.id, quantity: 2, unitPrice: p2.price }],
  });

  // Bob — CANCELLED (đã hủy)
  const o5 = await createOrder({
    userId: bob.id,
    status: 'CANCELLED',
    shippingAddress: '456 Le Loi, Q1, HCMC',
    lines: [{ productId: p5.id, quantity: 1, unitPrice: p5.price }],
  });

  // Bob — PENDING thêm 1 cái nữa để test cancel từ phía user
  const o6 = await createOrder({
    userId: bob.id,
    status: 'PENDING',
    shippingAddress: '456 Le Loi, Q1, HCMC',
    lines: [
      { productId: p3.id, quantity: 2, unitPrice: p3.price },
      { productId: p5.id, quantity: 1, unitPrice: p5.price },
    ],
  });

  console.log(`✅ Created 6 orders`);

  // ── 5. Tạo Feedbacks ───────────────────────────────────────────────────────
  const mockFeedbacks = [
    {
      userId: alice.id,
      orderId: o1.id,
      productId: p1.id, // Lấy item đầu tiên của o1
      rating: 5,
      comment: 'Sản phẩm tuyệt vời, đúng như mô tả, giao hàng rất nhanh!',
      sentiment: 'POSITIVE' as const,
    },
    {
      userId: alice.id,
      orderId: o2.id,
      productId: p3.id, // Lấy item đầu tiên của o2
      rating: 4,
      comment: 'Hàng ổn, chất lượng khá tốt. Đóng gói chắc chắn.',
      sentiment: 'POSITIVE' as const,
    },
    {
      userId: alice.id,
      orderId: o3.id,
      productId: p1.id, // Lấy item đầu tiên của o3
      rating: 3,
      comment: 'Sản phẩm bình thường, không có gì đặc biệt. Giao hơi chậm.',
      sentiment: 'NEUTRAL' as const,
    },
    {
      userId: bob.id,
      orderId: o4.id,
      productId: p2.id, // Lấy item đầu tiên của o4
      rating: 5,
      comment: 'Cực kỳ hài lòng! Sẽ ủng hộ shop dài dài.',
      sentiment: 'POSITIVE' as const,
    },
    {
      userId: bob.id,
      orderId: o5.id,
      productId: p5.id, // Lấy item đầu tiên của o5
      rating: 2,
      comment: 'Hàng không đúng màu như ảnh, hơi thất vọng.',
      sentiment: 'NEGATIVE' as const,
    },
    {
      userId: bob.id,
      orderId: o6.id,
      productId: p3.id, // Lấy item đầu tiên của o6
      rating: 1,
      comment: 'Chất lượng kém, không đáng tiền. Không mua lại.',
      sentiment: 'NEGATIVE' as const,
    },
  ];

  const createdFeedbacks = await Promise.all(
    mockFeedbacks.map((data) => prisma.feedback.create({ data }))
  );

  console.log(`✅ Created ${createdFeedbacks.length} feedbacks:`);
  createdFeedbacks.forEach((f) =>
    console.log(
      `   id=${f.id} | orderId=${f.orderId} | userId=${f.userId} | productId=${f.productId} | rating=${f.rating}⭐ | ${f.sentiment}`
    )
  );

  // ── 6. In hướng dẫn test ───────────────────────────────────────────────────
  console.log('\n📋 Quick test reference:');
  console.log(`   alice userId  = ${alice.id}`);
  console.log(`   bob   userId  = ${bob.id}`);
  console.log(`   admin userId  = ${admin.id}`);
  console.log('\n🎉 Done! Thử các luồng:');
  console.log(`   PATCH /orders/${o1.id}/status  { "status": "CONFIRMED" }   → PENDING→CONFIRMED`);
  console.log(`   PATCH /orders/${o2.id}/status  { "status": "SHIPPING" }    → CONFIRMED→SHIPPING`);
  console.log(`   PATCH /orders/${o3.id}/status  { "status": "DONE" }        → SHIPPING→DONE`);
  console.log(`   PATCH /orders/me/${o6.id}/cancel  userId=${bob.id}         → user cancel PENDING`);
  console.log(`   PATCH /orders/${o2.id}/status  { "status": "CANCELLED" }   → ❌ 422 (đã CONFIRMED)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());