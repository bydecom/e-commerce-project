import { PrismaClient } from '@prisma/client';
import process from 'process';

const prisma = new PrismaClient();

function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Random int in [min, max] inclusive */
function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random element from array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a Date that is exactly `daysBack` days before now,
 * with a random hour so orders on the same day are spread out.
 */
function daysAgo(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(ri(7, 22), ri(0, 59), ri(0, 59), 0);
  return d;
}

async function main() {
  console.log('🌱 Starting RICH E-commerce database seeding (VND)...');

  // ── 1. CLEANUP ──────────────────────────────────────────────────────────────
  await prisma.feedback.deleteMany();
  await prisma.feedbackType.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.storeSetting.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleared existing records.');

  // ── 2. STORE SETTINGS ───────────────────────────────────────────────────────
  await prisma.storeSetting.create({
    data: {
      name: 'BanDai',
      address: '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City',
      phone: '1800-555-0199',
      email: 'support@technova.demo',
      logoUrl: '',
      description: 'Your destination for premium technology and electronics.',
    },
  });

  // ── 3. FEEDBACK TYPES ───────────────────────────────────────────────────────
  const [typeQuality, typeShipping, typeService, typeUnknown] = await Promise.all([
    prisma.feedbackType.create({ data: { name: 'Product quality', description: 'Durability, design, and performance' } }),
    prisma.feedbackType.create({ data: { name: 'Shipping & packaging', description: 'Delivery speed and packaging condition' } }),
    prisma.feedbackType.create({ data: { name: 'Customer service', description: 'Support, communication, and issue resolution' } }),
    prisma.feedbackType.create({ data: { name: 'Unknown', description: 'Fallback when AI cannot determine a category' } }),
  ]);
  const feedbackTypes = [typeQuality, typeShipping, typeService, typeUnknown];
  console.log('✅ Feedback types created.');

  // ── 4. USERS — 1 admin + 20 customers ──────────────────────────────────────
  await prisma.user.create({
    data: { email: 'admin@example.com', password: 'hashed_pw_admin', name: 'Administrator', role: 'ADMIN' },
  });

  const customerData = [
    { name: 'Emily Watson',   email: 'lan@example.com',   phone: '0901234001', address: '12 Oak Avenue, Austin, TX 78701' },
    { name: 'James Miller',   email: 'minh@example.com',  phone: '0901234002', address: '45 Maple Road, Seattle, WA 98101' },
    { name: 'Sophia Chen',    email: 'hoa@example.com',   phone: '0901234003', address: '78 Pine Street, Portland, OR 97201' },
    { name: 'Daniel Brooks',  email: 'hung@example.com',  phone: '0901234004', address: '23 Cedar Lane, Denver, CO 80202' },
    { name: 'Olivia Grant',   email: 'mai@example.com',   phone: '0901234005', address: '56 Birch Drive, Miami, FL 33101' },
    { name: 'Ryan Cooper',    email: 'nam@example.com',   phone: '0901234006', address: '34 Elm Court, Chicago, IL 60601' },
    { name: 'Chloe Adams',    email: 'ngoc@example.com',  phone: '0901234007', address: '90 Willow Way, Boston, MA 02108' },
    { name: 'Ethan Parker',   email: 'phuc@example.com',  phone: '0901234008', address: '11 Ash Boulevard, Atlanta, GA 30303' },
    { name: 'Mia Sullivan',   email: 'quynh@example.com', phone: '0901234009', address: '67 Spruce Street, Phoenix, AZ 85001' },
    { name: 'Noah Bennett',   email: 'son@example.com',   phone: '0901234010', address: '29 Hickory Road, Dallas, TX 75201' },
    { name: 'Ava Richardson', email: 'thu@example.com',   phone: '0901234011', address: '8 Cypress Path, San Diego, CA 92101' },
    { name: 'Liam Foster',    email: 'tuan@example.com',  phone: '0901234012', address: '15 Redwood Ave, Los Angeles, CA 90001' },
    { name: 'Grace Hughes',   email: 'uyen@example.com',  phone: '0901234013', address: '52 Magnolia Lane, Nashville, TN 37201' },
    { name: 'Jack Morgan',    email: 'viet@example.com',  phone: '0901234014', address: '33 Sycamore St, Houston, TX 77001' },
    { name: 'Lily Carter',    email: 'xuan@example.com',  phone: '0901234015', address: '71 Dogwood Circle, Charlotte, NC 28201' },
    { name: 'Henry Ward',     email: 'yen@example.com',   phone: '0901234016', address: '18 Poplar Drive, Philadelphia, PA 19101' },
    { name: 'Zoe Mitchell',   email: 'anh@example.com',   phone: '0901234017', address: '44 Laurel Way, Tampa, FL 33601' },
    { name: 'Owen Hayes',     email: 'binh@example.com',  phone: '0901234018', address: '62 Juniper Road, Columbus, OH 43201' },
    { name: 'Nora Price',     email: 'cam@example.com',   phone: '0901234019', address: '5 Chestnut Street, San Francisco, CA 94102' },
    { name: 'Leo Sanders',    email: 'dung@example.com',  phone: '0901234020', address: '88 Walnut Avenue, Detroit, MI 48201' },
  ];

  const customers = await Promise.all(
    customerData.map((c) =>
      prisma.user.create({ data: { ...c, password: 'hashed_pw', role: 'USER' } }),
    ),
  );
  console.log(`✅ Created ${customers.length} customers + 1 admin.`);

  // ── 5. CATEGORIES & 30 PRODUCTS (prices in VND) ──────────────────────────────
  const [catPhones, catLaptops, catAccessories] = await Promise.all([
    prisma.category.create({ data: { name: 'Phones & tablets' } }),
    prisma.category.create({ data: { name: 'Laptops & computers' } }),
    prisma.category.create({ data: { name: 'Tech accessories' } }),
  ]);

  const rawProducts = [
    // Phones & tablets
    { name: 'iPhone 15 Pro Max 256GB',     price: 29_990_000, catId: catPhones.id,      stock: ri(5, 40),   desc: 'Titanium design, A17 Pro chip.' },
    { name: 'Samsung Galaxy S24 Ultra',    price: 31_990_000, catId: catPhones.id,      stock: ri(5, 30),   desc: 'Galaxy AI at your fingertips.' },
    { name: 'Google Pixel 8 Pro',          price: 23_990_000, catId: catPhones.id,      stock: ri(10, 50),  desc: "Google's best AI experience." },
    { name: 'OnePlus 12 5G',              price: 18_990_000, catId: catPhones.id,      stock: ri(15, 60),  desc: 'Smooth Snapdragon 8 Gen 3 performance.' },
    { name: 'Sony Xperia 1 V',            price: 34_990_000, catId: catPhones.id,      stock: ri(3, 15),   desc: 'Professional-grade camera quality.' },
    { name: 'iPad Pro 12.9-inch M2',       price: 27_990_000, catId: catPhones.id,      stock: ri(8, 35),   desc: 'Outstanding performance, stunning display.' },
    { name: 'Samsung Galaxy Tab S9 Ultra', price: 28_990_000, catId: catPhones.id,      stock: ri(5, 20),   desc: 'The new standard for premium tablets.' },
    { name: 'iPad Air 5th Gen',           price: 15_990_000, catId: catPhones.id,      stock: ri(20, 70),  desc: 'Thin, light, and powerful.' },
    { name: 'Xiaomi Pad 6',              price: 9_490_000,  catId: catPhones.id,      stock: 0,           desc: 'Built for work and entertainment.' },
    { name: 'Microsoft Surface Pro 9',    price: 24_990_000, catId: catPhones.id,      stock: ri(5, 25),   desc: 'Flexible 2-in-1 laptop and tablet.' },
    // Laptops & computers
    { name: 'MacBook Pro 14-inch M3',     price: 39_990_000, catId: catLaptops.id,     stock: ri(5, 20),   desc: 'Breakthrough M3 chip power.' },
    { name: 'Dell XPS 15',               price: 37_990_000, catId: catLaptops.id,     stock: ri(8, 30),   desc: 'OLED display, high performance.' },
    { name: 'Lenovo ThinkPad X1 Carbon',  price: 35_990_000, catId: catLaptops.id,     stock: ri(10, 40),  desc: 'Ultra-thin, ultra-light, ultra-durable.' },
    { name: 'ASUS ROG Zephyrus G14',      price: 42_990_000, catId: catLaptops.id,     stock: ri(5, 15),   desc: 'The best 14-inch gaming laptop.' },
    { name: 'HP Spectre x360',           price: 32_990_000, catId: catLaptops.id,     stock: ri(10, 35),  desc: 'Premium design, versatile 2-in-1.' },
    { name: 'Razer Blade 15',            price: 57_990_000, catId: catLaptops.id,     stock: ri(3, 12),   desc: 'The most compact 15.6-inch gaming laptop.' },
    { name: 'Acer Predator Helios 300',  price: 29_990_000, catId: catLaptops.id,     stock: 0,           desc: 'Advanced cooling system.' },
    { name: 'MSI Stealth 16 Studio',     price: 47_990_000, catId: catLaptops.id,     stock: ri(4, 10),   desc: 'Sharp looks, excellent performance.' },
    { name: 'MacBook Air 15-inch M2',    price: 32_990_000, catId: catLaptops.id,     stock: ri(15, 50),  desc: 'Incredibly thin, surprisingly fast.' },
    { name: 'LG Gram 17',               price: 37_990_000, catId: catLaptops.id,     stock: ri(5, 20),   desc: 'Ultra-light 17-inch laptop.' },
    // Accessories
    { name: 'Sony WH-1000XM5',           price: 8_490_000,  catId: catAccessories.id, stock: ri(20, 80),  desc: 'Industry-leading noise cancellation.' },
    { name: 'AirPods Pro 2nd Gen',       price: 5_990_000,  catId: catAccessories.id, stock: ri(30, 90),  desc: 'Audio rebuilt from the ground up.' },
    { name: 'Logitech MX Master 3S',     price: 2_390_000,  catId: catAccessories.id, stock: ri(40, 100), desc: 'The iconic mouse, upgraded.' },
    { name: 'Keychron K8 Pro Wireless',  price: 2_590_000,  catId: catAccessories.id, stock: ri(25, 70),  desc: 'Wireless mechanical keyboard with QMK/VIA.' },
    { name: 'Apple Watch Series 9',      price: 9_990_000,  catId: catAccessories.id, stock: 3,           desc: 'Smarter, brighter, and more capable.' },
    { name: 'Garmin Fenix 7X Pro',       price: 22_990_000, catId: catAccessories.id, stock: ri(5, 15),   desc: 'Top-tier multi-sport GPS watch.' },
    { name: 'Anker 737 Power Bank',      price: 3_590_000,  catId: catAccessories.id, stock: ri(50, 120), desc: 'Powerful two-way fast charging.' },
    { name: 'Ugreen 100W GaN Charger',   price: 1_390_000,  catId: catAccessories.id, stock: 7,           desc: 'Fast-charge up to four devices at once.' },
    { name: 'Samsung T7 Shield 2TB SSD', price: 3_990_000,  catId: catAccessories.id, stock: ri(20, 60),  desc: 'Rugged, fast portable storage.' },
    { name: 'Elgato Stream Deck MK.2',   price: 3_490_000,  catId: catAccessories.id, stock: ri(15, 40),  desc: '15 customizable LCD keys for streamers.' },
  ];

  await prisma.product.createMany({
    data: rawProducts.map((p, i) => ({
      name: p.name,
      title_unaccent: removeAccents(p.name),
      description: p.desc,
      price: p.price,
      stock: p.stock,
      imageUrl: `https://via.placeholder.com/300x300/F3F4F6/333333/?text=Product+${i + 1}`,
      status: 'AVAILABLE' as const,
      categoryId: p.catId,
    })),
  });

  const allProducts = await prisma.product.findMany({ orderBy: { id: 'asc' } });
  console.log(`✅ Created 3 categories and ${allProducts.length} products.`);

  // ── 6. ORDERS — 120 orders, strictly oldest → newest ────────────────────────
  //
  // Strategy: assign each order a "daysBack" value from 59 down to 0,
  // so when sorted by createdAt ASC the IDs are naturally chronological.
  //
  // Distribution of dates:
  //   orders 0–29  : daysBack 59 → 30  (older history)
  //   orders 30–89 : daysBack 29 → 7   (mid-range)
  //   orders 90–119: daysBack 6  → 0   (last 7 days — ensures chart data)
  //
  // Within each bucket we step evenly so there are no duplicate days at the
  // extremes, and each "slot" gets a random hour for variety.

  type OrderStatus = 'DONE' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'CANCELLED';

  // Weight: DONE 55 % | SHIPPING 15 % | CONFIRMED 12 % | PENDING 10 % | CANCELLED 8 %
  const statusPool: OrderStatus[] = [
    ...Array<OrderStatus>(55).fill('DONE'),
    ...Array<OrderStatus>(15).fill('SHIPPING'),
    ...Array<OrderStatus>(12).fill('CONFIRMED'),
    ...Array<OrderStatus>(10).fill('PENDING'),
    ...Array<OrderStatus>(8).fill('CANCELLED'),
  ];

  /** Linear map from order index to daysBack (largest first = oldest first). */
  function daysBackForIndex(i: number): number {
    if (i < 30)  return 59 - Math.floor((i / 29) * 29);  // 59 → 30
    if (i < 90)  return 29 - Math.floor(((i - 30) / 59) * 22); // 29 → 7
    return 6 - Math.floor(((i - 90) / 29) * 6);           // 6 → 0
  }

  for (let i = 0; i < 120; i++) {
    const customer = pick(customers);
    const status: OrderStatus = pick(statusPool);
    const itemCount = ri(1, 4);
    const chosenProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, itemCount);

    const items = chosenProducts.map((p) => ({
      productId: p.id,
      quantity: ri(1, 3),
      unitPrice: p.price,
    }));
    const total = items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const orderDate = daysAgo(daysBackForIndex(i));

    await prisma.order.create({
      data: {
        userId: customer.id,
        status,
        total,
        shippingAddress: customer.address ?? '',
        createdAt: orderDate,
        items: { create: items },
      },
    });
  }
  console.log('✅ Created 120 orders in chronological order (oldest → newest).');

  // ── 7. FEEDBACKS on DONE orders (~70 % coverage) ────────────────────────────
  const doneOrdersFromDb = await prisma.order.findMany({
    where: { status: 'DONE' },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  });

  const positiveComments = [
    'Amazing product! Far exceeded my expectations.',
    'Fast delivery, careful packaging. Will buy again!',
    'Excellent quality, worth every penny.',
    'Support staff were very helpful and professional.',
    'Arrived sooner than expected, exactly as described.',
    'The fit and finish of the product really impressed me.',
    'Great value for the quality — highly recommend!',
    'Solid packaging, quick shipping. Very satisfied.',
    'Best purchase I have made this year.',
    'Perfect experience from order to unboxing.',
  ];
  const neutralComments = [
    'It is fine and usable, nothing standout.',
    'Arrived one day late but the item was OK.',
    'Outer box was a bit dented but the product inside was intact.',
    'Average quality — not bad, not great.',
    'Works as described, neither better nor worse.',
    'Waited a bit long but overall acceptable.',
    'Decent product; I have used better at this price point.',
  ];
  const negativeComments = [
    'Very disappointed. It broke after one week.',
    'Cheap materials — feels flimsy in the hand.',
    'Arrived scratched; packaging was careless.',
    'Not as described; photos and reality are very different.',
    'Reached out to support and got no real resolution.',
    'Runs hot under normal use — does not feel safe.',
    'Screen defect out of the box, constant flickering.',
    'Terrible battery life, only lasts a few hours.',
  ];

  // 60 % POSITIVE | 25 % NEUTRAL | 15 % NEGATIVE
  const sentimentPool = [
    ...Array<'POSITIVE'>(60).fill('POSITIVE'),
    ...Array<'NEUTRAL'>(25).fill('NEUTRAL'),
    ...Array<'NEGATIVE'>(15).fill('NEGATIVE'),
  ];

  let feedbackCount = 0;
  for (const order of doneOrdersFromDb) {
    if (Math.random() > 0.70) continue; // ~70 % of DONE orders get reviewed
    const itemsToReview = [...order.items].sort(() => 0.5 - Math.random()).slice(0, ri(1, 2));
    for (const item of itemsToReview) {
      const sentiment = pick(sentimentPool);
      const rating =
        sentiment === 'POSITIVE' ? ri(4, 5) :
        sentiment === 'NEUTRAL'  ? 3 :
        ri(1, 2);
      const comment =
        sentiment === 'POSITIVE' ? pick(positiveComments) :
        sentiment === 'NEUTRAL'  ? pick(neutralComments)  :
        pick(negativeComments);
      await prisma.feedback.create({
        data: {
          userId:    order.userId,
          orderId:   order.id,
          productId: item.productId,
          typeId:    pick(feedbackTypes).id,
          rating,
          sentiment,
          comment,
        },
      });
      feedbackCount++;
    }
  }
  console.log(`✅ Created ${feedbackCount} feedbacks on DONE orders.`);

  // ── 8. SUMMARY ──────────────────────────────────────────────────────────────
  const totalOrders  = await prisma.order.count();
  const totalRevenue = await prisma.order.aggregate({ where: { status: 'DONE' }, _sum: { total: true } });
  const totalFeedbacks = await prisma.feedback.count();

  console.log('\n🎉 SEED COMPLETE!');
  console.log(`   👤 Customers : ${customers.length} + 1 admin`);
  console.log(`   📦 Products  : ${allProducts.length} (includes low-stock / out-of-stock items)`);
  console.log(`   🛒 Orders    : ${totalOrders} (oldest → newest)`);
  console.log(`   💰 Revenue   : ${totalRevenue._sum.total?.toLocaleString('en-US')} VND (DONE)`);
  console.log(`   ⭐ Reviews   : ${totalFeedbacks} (60% positive / 25% neutral / 15% negative)`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());