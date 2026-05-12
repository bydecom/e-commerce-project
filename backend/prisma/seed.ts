// import { PrismaClient } from '@prisma/client';
// import process from 'process';
// import { syncPostgresToQdrant } from '../src/scripts/sync-qdrant';

// const prisma = new PrismaClient();

// function removeAccents(str: string) {
//   return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// }

// function ri(min: number, max: number) {
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// }

// function pick<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)];
// }

// function daysAgo(daysBack: number): Date {
//   const d = new Date();
//   d.setDate(d.getDate() - daysBack);
//   d.setHours(ri(7, 22), ri(0, 59), ri(0, 59), 0);
//   return d;
// }

// async function main() {
//   console.log('🌱 Starting RICH E-commerce database seeding (VND)...');

//   // ── 1. CLEANUP ──────────────────────────────────────────────────────────────
//   await prisma.feedbackActionPlan.deleteMany();
//   await prisma.feedback.deleteMany();
//   await prisma.feedbackType.deleteMany();
//   await prisma.orderItem.deleteMany();
//   await prisma.order.deleteMany();
//   await prisma.product.deleteMany();
//   await prisma.category.deleteMany();
//   await prisma.storeSetting.deleteMany();
//   await prisma.user.deleteMany();
//   // Note: Do not deleteMany SystemConfig table to avoid losing admin-configured configs
//   console.log('🧹 Cleared existing records.');

//   // ── 2. SYSTEM CONFIG (skip duplicates) ─────────────────────────────────────
//   const systemConfigs = [
//     { key: 'jwt_access_expires_in', value: '840', description: 'Access token lifetime (seconds)' },
//     { key: 'refresh_token_ttl_seconds', value: '900', description: 'Refresh token lifetime in seconds' },
//     { key: 'verify_token_ttl_seconds', value: '180', description: 'Email verification link lifetime in seconds' },
//     { key: 'pending_register_ttl_seconds', value: '1800', description: 'Pending registration cleanup TTL in seconds' },
//     { key: 'product_cache_ttl_seconds', value: '5', description: 'Product detail Redis cache TTL in seconds (max 3600)' },
//     { key: 'checkout_reservation_ttl_seconds', value: '900', description: 'Stock reservation hold time at checkout in seconds (60–3600)' },
//     { key: 'use_gemini', value: 'false', description: 'Use Gemini AI instead of local LLM (true/false)' },
//     { key: 'gemini_api_key', value: '', description: 'Gemini API key (leave empty to use local LLM)' },
//     { key: 'vnp_return_url', value: 'https://localhost:4200', description: 'VNPay redirect URL after payment' },
//   ] as const;

//   await (prisma as any).systemConfig.createMany({
//     data: systemConfigs,
//     skipDuplicates: true,
//   });
//   console.log('✅ System configs seeded (skipped existing).');

//   // ── 2. STORE SETTINGS ───────────────────────────────────────────────────────
//   await prisma.storeSetting.create({
//     data: {
//       name: 'BanDai',
//       address: '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City',
//       phone: '1800-555-0199',
//       email: 'support@technova.demo',
//       logoUrl: 'https://i.postimg.cc/nLLk9Cfh/Gemini-Generated-Image-t4b4bet4b4bet4b4-Photoroom.png',
//       description: 'Your destination for premium technology and electronics.',
//     },
//   });

//   // ── 3. FEEDBACK TYPES ───────────────────────────────────────────────────────
//   const [typeQuality, typeShipping, typeService, typeUnknown] = await Promise.all([
//     prisma.feedbackType.create({ data: { name: 'Product quality', description: 'Durability, design, and performance' } }),
//     prisma.feedbackType.create({ data: { name: 'Shipping & packaging', description: 'Delivery speed and packaging condition' } }),
//     prisma.feedbackType.create({ data: { name: 'Customer service', description: 'Support, communication, and issue resolution' } }),
//     prisma.feedbackType.create({ data: { name: 'Unknown', description: 'Fallback when AI cannot determine a category' } }),
//   ]);
//   const feedbackTypes = [typeQuality, typeShipping, typeService, typeUnknown];
//   console.log('✅ Feedback types created.');

//   // ── 4. USERS — 1 admin + 20 customers ──────────────────────────────────────
//   const adminUser = await prisma.user.create({
//     data: { email: 'admin@example.com', password: 'hashed_pw_admin', name: 'Administrator', role: 'ADMIN' },
//   });

//   const customerData = [
//     { name: 'Emily Watson',   email: 'lan@example.com',   phone: '0901234001', address: '12 Oak Avenue, Austin, TX 78701' },
//     { name: 'James Miller',   email: 'minh@example.com',  phone: '0901234002', address: '45 Maple Road, Seattle, WA 98101' },
//     { name: 'Sophia Chen',    email: 'hoa@example.com',   phone: '0901234003', address: '78 Pine Street, Portland, OR 97201' },
//     { name: 'Daniel Brooks',  email: 'hung@example.com',  phone: '0901234004', address: '23 Cedar Lane, Denver, CO 80202' },
//     { name: 'Olivia Grant',   email: 'mai@example.com',   phone: '0901234005', address: '56 Birch Drive, Miami, FL 33101' },
//     { name: 'Ryan Cooper',    email: 'nam@example.com',   phone: '0901234006', address: '34 Elm Court, Chicago, IL 60601' },
//     { name: 'Chloe Adams',    email: 'ngoc@example.com',  phone: '0901234007', address: '90 Willow Way, Boston, MA 02108' },
//     { name: 'Ethan Parker',   email: 'phuc@example.com',  phone: '0901234008', address: '11 Ash Boulevard, Atlanta, GA 30303' },
//     { name: 'Mia Sullivan',   email: 'quynh@example.com', phone: '0901234009', address: '67 Spruce Street, Phoenix, AZ 85001' },
//     { name: 'Noah Bennett',   email: 'son@example.com',   phone: '0901234010', address: '29 Hickory Road, Dallas, TX 75201' },
//     { name: 'Ava Richardson', email: 'thu@example.com',   phone: '0901234011', address: '8 Cypress Path, San Diego, CA 92101' },
//     { name: 'Liam Foster',    email: 'tuan@example.com',  phone: '0901234012', address: '15 Redwood Ave, Los Angeles, CA 90001' },
//     { name: 'Grace Hughes',   email: 'uyen@example.com',  phone: '0901234013', address: '52 Magnolia Lane, Nashville, TN 37201' },
//     { name: 'Jack Morgan',    email: 'viet@example.com',  phone: '0901234014', address: '33 Sycamore St, Houston, TX 77001' },
//     { name: 'Lily Carter',    email: 'xuan@example.com',  phone: '0901234015', address: '71 Dogwood Circle, Charlotte, NC 28201' },
//     { name: 'Henry Ward',     email: 'yen@example.com',   phone: '0901234016', address: '18 Poplar Drive, Philadelphia, PA 19101' },
//     { name: 'Zoe Mitchell',   email: 'anh@example.com',   phone: '0901234017', address: '44 Laurel Way, Tampa, FL 33601' },
//     { name: 'Owen Hayes',     email: 'binh@example.com',  phone: '0901234018', address: '62 Juniper Road, Columbus, OH 43201' },
//     { name: 'Nora Price',     email: 'cam@example.com',   phone: '0901234019', address: '5 Chestnut Street, San Francisco, CA 94102' },
//     { name: 'Leo Sanders',    email: 'dung@example.com',  phone: '0901234020', address: '88 Walnut Avenue, Detroit, MI 48201' },
//   ];

//   const customers = await Promise.all(
//     customerData.map((c) =>
//       prisma.user.create({
//         data: {
//           name: c.name,
//           email: c.email,
//           phone: c.phone,
//           streetAddress: c.address,
//           fullAddress: c.address,
//           password: 'hashed_pw',
//           role: 'USER',
//         },
//       }),
//     ),
//   );
//   console.log(`✅ Created ${customers.length} customers + 1 admin.`);

//   // ── 5. CATEGORIES — 6 independent, single-concept categories ────────────────
//   const [
//     catSmartphone,
//     catLaptop,
//     catTablet,
//     catHeadphone,
//     catSmarwatch,
//     catCharger,
//   ] = await Promise.all([
//     prisma.category.create({ data: { name: 'Smartphone' } }),
//     prisma.category.create({ data: { name: 'Laptop' } }),
//     prisma.category.create({ data: { name: 'Tablet' } }),
//     prisma.category.create({ data: { name: 'Headphone' } }),
//     prisma.category.create({ data: { name: 'Smartwatch' } }),
//     prisma.category.create({ data: { name: 'Charger' } }),
//   ]);

//   // ── 6. PRODUCTS — 50 products spread across 6 categories ────────────────────
//   const rawProducts = [
//     // ── Smartphone (10) ──────────────────────────────────────────────────────
//     { name: 'iPhone 15 Pro Max 256GB',          price: 29_990_000, cat: catSmartphone, stock: ri(5,  40), desc: 'Titanium frame, A17 Pro chip, 48MP main camera.' },
//     { name: 'iPhone 15 128GB',                  price: 22_490_000, cat: catSmartphone, stock: ri(10, 60), desc: 'Dynamic Island, USB-C, all-day battery.' },
//     { name: 'Samsung Galaxy S24 Ultra 512GB',   price: 33_990_000, cat: catSmartphone, stock: ri(5,  25), desc: 'Built-in S Pen, 200MP camera, Galaxy AI.' },
//     { name: 'Samsung Galaxy A55 5G 256GB',      price: 9_990_000,  cat: catSmartphone, stock: ri(20, 80), desc: 'Slim design, 50MP OIS camera, IP67 rating.' },
//     { name: 'Google Pixel 8 Pro 128GB',         price: 23_990_000, cat: catSmartphone, stock: ri(8,  35), desc: 'Best computational photography on Android.' },
//     { name: 'OnePlus 12 5G 256GB',              price: 18_990_000, cat: catSmartphone, stock: ri(10, 45), desc: 'Snapdragon 8 Gen 3, 100W SuperVOOC charging.' },
//     { name: 'Xiaomi 14 Pro 512GB',              price: 26_990_000, cat: catSmartphone, stock: ri(5,  20), desc: 'Leica optics, Snapdragon 8 Gen 3, 120W charging.' },
//     { name: 'OPPO Find X7 Ultra 256GB',         price: 28_490_000, cat: catSmartphone, stock: ri(3,  15), desc: 'Dual periscope camera, Hasselblad color tuning.' },
//     { name: 'Vivo X100 Pro 256GB',              price: 25_990_000, cat: catSmartphone, stock: ri(5,  20), desc: 'ZEISS optics, 100W wireless flash charging.' },
//     { name: 'Realme GT 6 256GB',                price: 13_490_000, cat: catSmartphone, stock: 0,          desc: 'Snapdragon 8s Gen 3, 120Hz AMOLED, 120W turbo.' },

//     // ── Laptop (10) ───────────────────────────────────────────────────────────
//     { name: 'MacBook Pro 14-inch M3 Pro',       price: 44_990_000, cat: catLaptop, stock: ri(5,  20), desc: 'M3 Pro chip, 18GB RAM, Liquid Retina XDR display.' },
//     { name: 'MacBook Air 15-inch M2',           price: 32_990_000, cat: catLaptop, stock: ri(10, 40), desc: 'Fanless design, 18-hour battery, 1080p webcam.' },
//     { name: 'Dell XPS 15 9530',                 price: 38_990_000, cat: catLaptop, stock: ri(5,  25), desc: 'OLED 3.5K touch display, RTX 4060, 13th Gen Intel.' },
//     { name: 'Lenovo ThinkPad X1 Carbon Gen 12', price: 36_490_000, cat: catLaptop, stock: ri(8,  30), desc: 'Ultra-light 1.12 kg, vPro, MIL-SPEC certified.' },
//     { name: 'ASUS ROG Zephyrus G14 2024',       price: 43_990_000, cat: catLaptop, stock: ri(4,  15), desc: 'Ryzen 9 8945HS, RTX 4070, 120Hz OLED panel.' },
//     { name: 'HP Spectre x360 14',               price: 34_990_000, cat: catLaptop, stock: ri(8,  30), desc: '2-in-1 OLED, Intel Core Ultra 7, OLED pen display.' },
//     { name: 'Razer Blade 16 2024',              price: 59_990_000, cat: catLaptop, stock: ri(2,  10), desc: 'RTX 4090, dual-mode 240Hz OLED, per-key RGB.' },
//     { name: 'MSI Stealth 16 Studio A13V',       price: 49_990_000, cat: catLaptop, stock: ri(3,  12), desc: 'RTX 4070, QHD+ 240Hz, Intel Core i9 HX.' },
//     { name: 'Acer Swift 14 AI',                 price: 21_990_000, cat: catLaptop, stock: ri(10, 50), desc: 'Intel Core Ultra 5, NPU for AI tasks, OLED display.' },
//     { name: 'LG Gram 17 2024',                  price: 38_490_000, cat: catLaptop, stock: 0,          desc: 'Only 1.35 kg, 17-inch IPS, 22-hour battery life.' },

//     // ── Tablet (8) ────────────────────────────────────────────────────────────
//     { name: 'iPad Pro 13-inch M4 256GB WiFi',   price: 32_990_000, cat: catTablet, stock: ri(5,  20), desc: 'Ultra Retina XDR OLED, M4 chip, under 6mm thin.' },
//     { name: 'iPad Air 11-inch M2 128GB WiFi',   price: 17_990_000, cat: catTablet, stock: ri(15, 50), desc: 'Powerful M2 chip, supports Apple Pencil Pro.' },
//     { name: 'iPad mini 7th Gen 64GB WiFi',      price: 13_990_000, cat: catTablet, stock: ri(10, 40), desc: 'Compact 8.3-inch, A17 Pro, USB-C.' },
//     { name: 'Samsung Galaxy Tab S9 Ultra 256GB',price: 29_990_000, cat: catTablet, stock: ri(4,  18), desc: '14.6-inch AMOLED, S Pen included, IP68.' },
//     { name: 'Samsung Galaxy Tab S9 FE 128GB',   price: 10_490_000, cat: catTablet, stock: ri(15, 55), desc: 'Exynos 1380, 45W charging, IP68 durability.' },
//     { name: 'Xiaomi Pad 6S Pro 256GB',          price: 12_990_000, cat: catTablet, stock: ri(8,  30), desc: 'Snapdragon 8 Gen 2, 144Hz display, 10000mAh.' },
//     { name: 'Lenovo Tab P12 Pro 256GB',         price: 15_490_000, cat: catTablet, stock: ri(5,  20), desc: '12.6-inch AMOLED, Snapdragon 870, stylus support.' },
//     { name: 'Microsoft Surface Pro 10',         price: 27_990_000, cat: catTablet, stock: ri(4,  15), desc: 'Intel Core Ultra, detachable keyboard, 13-inch.' },

//     // ── Headphone (8) ─────────────────────────────────────────────────────────
//     { name: 'Sony WH-1000XM5',                  price: 8_490_000,  cat: catHeadphone, stock: ri(20, 80), desc: 'Industry-leading ANC, 30-hour battery, LDAC.' },
//     { name: 'Apple AirPods Pro 2nd Gen',        price: 5_990_000,  cat: catHeadphone, stock: ri(30, 90), desc: 'Adaptive Audio, H2 chip, MagSafe charging case.' },
//     { name: 'Bose QuietComfort Ultra',          price: 9_990_000,  cat: catHeadphone, stock: ri(10, 40), desc: 'Immersive audio, CustomTune ANC, 24-hour life.' },
//     { name: 'Samsung Galaxy Buds3 Pro',         price: 4_490_000,  cat: catHeadphone, stock: ri(15, 60), desc: 'Blade design, 360° audio, hi-fi 24-bit sound.' },
//     { name: 'Jabra Evolve2 85',                 price: 10_490_000, cat: catHeadphone, stock: ri(5,  25), desc: '10-mic ANC, UC certified, 37-hour battery.' },
//     { name: 'Sennheiser Momentum 4 Wireless',   price: 8_990_000,  cat: catHeadphone, stock: ri(8,  30), desc: 'Crystal-clear sound, 60-hour battery, ANC.' },
//     { name: 'Audio-Technica ATH-M50xBT2',       price: 3_990_000,  cat: catHeadphone, stock: ri(20, 70), desc: 'Studio-reference sound, 50-hour wireless battery.' },
//     { name: 'Nothing Ear 2',                    price: 2_990_000,  cat: catHeadphone, stock: 0,          desc: 'Transparent design, Hi-Res Audio, LHDC 5.0.' },

//     // ── Smartwatch (7) ────────────────────────────────────────────────────────
//     { name: 'Apple Watch Series 10 GPS 46mm',   price: 11_990_000, cat: catSmarwatch, stock: ri(10, 40), desc: 'Largest display ever, 30% thinner, sleep apnea detection.' },
//     { name: 'Apple Watch Ultra 2',              price: 22_990_000, cat: catSmarwatch, stock: ri(3,  12), desc: 'Titanium case, dual-frequency GPS, 60-hour battery.' },
//     { name: 'Samsung Galaxy Watch 7 44mm',      price: 8_990_000,  cat: catSmarwatch, stock: ri(10, 45), desc: 'Advanced BioActive sensor, AI health coaching.' },
//     { name: 'Garmin Fenix 8 Solar 47mm',        price: 24_990_000, cat: catSmarwatch, stock: ri(3,  12), desc: 'Solar charging, multi-band GPS, AMOLED display.' },
//     { name: 'Garmin Venu 3',                    price: 11_490_000, cat: catSmarwatch, stock: ri(8,  30), desc: 'AMOLED display, wheelchair activity tracking, Nap detection.' },
//     { name: 'Fitbit Sense 3',                   price: 5_990_000,  cat: catSmarwatch, stock: ri(15, 55), desc: 'ECG sensor, EDA scan, skin temperature, SpO2.' },
//     { name: 'Amazfit GTR 4',                    price: 3_490_000,  cat: catSmarwatch, stock: ri(20, 70), desc: '150+ sports modes, 14-day battery, dual-band GPS.' },

//     // ── Charger (7) ───────────────────────────────────────────────────────────
//     { name: 'Anker Prime 27650mAh Power Bank',  price: 4_990_000,  cat: catCharger, stock: ri(30, 80), desc: '250W output, charge 3 devices simultaneously.' },
//     { name: 'Anker 737 GaN Charger 120W',       price: 2_490_000,  cat: catCharger, stock: ri(30, 90), desc: '3-port GaN, charges laptop + phone + tablet at once.' },
//     { name: 'Ugreen Nexode 100W GaN Charger',   price: 1_390_000,  cat: catCharger, stock: 7,          desc: '4-port ultra-compact, universal compatibility.' },
//     { name: 'Baseus 65W USB-C GaN Charger',     price: 890_000,    cat: catCharger, stock: ri(40, 100), desc: 'Foldable pins, PD 3.0, supports MacBook Air.' },
//     { name: 'Apple MagSafe Charger 1m',         price: 990_000,    cat: catCharger, stock: ri(30, 80),  desc: 'Magnetic alignment, 15W fast wireless charging.' },
//     { name: 'Xiaomi 67W Turbo Charging Kit',    price: 690_000,    cat: catCharger, stock: ri(40, 100), desc: 'Includes turbo charger brick and USB-C cable.' },
//     { name: 'Samsung 25W Super Fast Charger',   price: 590_000,    cat: catCharger, stock: ri(50, 120), desc: 'USB-C PD, compatible with Galaxy S and Note series.' },
//   ];

//   await prisma.product.createMany({
//     data: rawProducts.map((p, i) => ({
//       name: p.name,
//       title_unaccent: removeAccents(p.name),
//       description: p.desc,
//       price: p.price,
//       stock: p.stock,
//       imageUrl: (() => {
//         const catId = p.cat.id;
//         if (catId === catSmartphone.id)
//           return 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcR7AJq9rOPmTE-DzPkDzybKEPU43HP5NKmFvROAFCrN3NodUUe3FXr28y60yqneGvoPTfUIkF2PuzdE-kBg4g3PqDJ0k6XpXsjXEhmMbkBuJHDiQMNB3fIToeGmX2Pge2zPGQ&usqp=CAc';
//         if (catId === catLaptop.id)
//           return 'https://surfaceviet.vn/wp-content/uploads/2024/05/Surface-Laptop-7-Black-13.8-inch.jpg';
//         if (catId === catTablet.id)
//           return 'https://lapvip.vn/upload/filters_img/thumb_350x0/1107-2-1722567148.jpg';
//         if (catId === catHeadphone.id)
//           return 'https://down-vn.img.susercontent.com/file/vn-11134207-7ra0g-m9d1mhxlbds700_tn';
//         if (catId === catSmarwatch.id)
//           return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOwR7zjuZ_6KQ2UGvhbW34oxIEcoSUQaiWfA&s';
//         if (catId === catCharger.id)
//           return 'https://bizweb.dktcdn.net/100/444/581/products/1-jpeg-7a7668dc-b7d3-46a2-b0e6-19caaef682f1.jpg?v=1641360367993';
//         return `https://via.placeholder.com/300x300/F3F4F6/333333/?text=Product+${i + 1}`;
//       })(),
//       status: 'AVAILABLE' as const,
//       categoryId: p.cat.id,
//     })),
//   });

//   const allProducts = await prisma.product.findMany({ orderBy: { id: 'asc' } });
//   console.log(`✅ Created 6 categories and ${allProducts.length} products.`);

//   // ── 7. ORDERS — 120 orders, strictly oldest → newest ────────────────────────
//   type OrderStatus = 'DONE' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'CANCELLED';
//   type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

//   const statusPool: OrderStatus[] = [
//     ...Array<OrderStatus>(55).fill('DONE'),
//     ...Array<OrderStatus>(15).fill('SHIPPING'),
//     ...Array<OrderStatus>(12).fill('CONFIRMED'),
//     ...Array<OrderStatus>(10).fill('PENDING'),
//     ...Array<OrderStatus>(8).fill('CANCELLED'),
//   ];

//   function daysBackForIndex(i: number): number {
//     if (i < 30)  return 59 - Math.floor((i / 29) * 29);
//     if (i < 90)  return 29 - Math.floor(((i - 30) / 59) * 22);
//     return 6 - Math.floor(((i - 90) / 29) * 6);
//   }

//   for (let i = 0; i < 120; i++) {
//     const customer = pick(customers);
//     const rawStatus: OrderStatus = pick(statusPool);
//     const status: 'PENDING' | 'DONE' = rawStatus === 'PENDING' ? 'PENDING' : 'DONE';
//     const paymentStatus: PaymentStatus = status === 'PENDING' ? pick(['PENDING', 'PAID']) : 'PAID';
//     const itemCount = ri(1, 4);
//     const chosenProducts = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, itemCount);

//     const items = chosenProducts.map((p) => ({
//       productId: p.id,
//       quantity: ri(1, 3),
//       unitPrice: p.price,
//     }));
//     const total = items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
//     const orderDate = daysAgo(daysBackForIndex(i));

//     await prisma.order.create({
//       data: {
//         userId: customer.id,
//         status,
//         paymentStatus,
//         total,
//         shippingAddress: customer.fullAddress ?? customer.streetAddress ?? '',
//         createdAt: orderDate,
//         items: { create: items },
//       } as any,
//     });
//   }
//   console.log('✅ Created 120 orders in chronological order (oldest → newest).');

//   // ── 8. FEEDBACKS & ACTION PLANS on DONE orders (~70% coverage) ──────────────
//   const doneOrdersFromDb = await prisma.order.findMany({
//     where: { status: 'DONE' },
//     orderBy: { createdAt: 'asc' },
//     include: { items: true },
//   });

//   const positiveComments = [
//     'Amazing product! Far exceeded my expectations.',
//     'Fast delivery, careful packaging. Will buy again!',
//     'Excellent quality, worth every penny.',
//     'Support staff were very helpful and professional.',
//     'Arrived sooner than expected, exactly as described.',
//     'The fit and finish of the product really impressed me.',
//     'Great value for the quality — highly recommend!',
//     'Solid packaging, quick shipping. Very satisfied.',
//     'Best purchase I have made this year.',
//     'Perfect experience from order to unboxing.',
//   ];
//   const neutralComments = [
//     'It is fine and usable, nothing standout.',
//     'Arrived one day late but the item was OK.',
//     'Outer box was a bit dented but the product inside was intact.',
//     'Average quality — not bad, not great.',
//     'Works as described, neither better nor worse.',
//     'Waited a bit long but overall acceptable.',
//     'Decent product; I have used better at this price point.',
//   ];
//   const negativeComments = [
//     'Very disappointed. It broke after one week.',
//     'Cheap materials — feels flimsy in the hand.',
//     'Arrived scratched; packaging was careless.',
//     'Not as described; photos and reality are very different.',
//     'Reached out to support and got no real resolution.',
//     'Runs hot under normal use — does not feel safe.',
//     'Screen defect out of the box, constant flickering.',
//     'Terrible battery life, only lasts a few hours.',
//   ];

//   const sentimentPool = [
//     ...Array<'POSITIVE'>(60).fill('POSITIVE'),
//     ...Array<'NEUTRAL'>(25).fill('NEUTRAL'),
//     ...Array<'NEGATIVE'>(15).fill('NEGATIVE'),
//   ];

//   type ActionPlanStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

//   let feedbackCount = 0;
//   let actionPlanCount = 0;

//   for (const order of doneOrdersFromDb) {
//     if (Math.random() > 0.70) continue;
//     const itemsToReview = [...order.items].sort(() => 0.5 - Math.random()).slice(0, ri(1, 2));

//     for (const item of itemsToReview) {
//       const sentiment = pick(sentimentPool);
//       const rating =
//         sentiment === 'POSITIVE' ? ri(4, 5) :
//         sentiment === 'NEUTRAL'  ? 3 :
//         ri(1, 2);
//       const comment =
//         sentiment === 'POSITIVE' ? pick(positiveComments) :
//         sentiment === 'NEUTRAL'  ? pick(neutralComments)  :
//         pick(negativeComments);

//       const fb = await prisma.feedback.create({
//         data: {
//           userId:    order.userId,
//           orderId:   order.id,
//           productId: item.productId,
//           typeId:    pick(feedbackTypes).id,
//           rating,
//           sentiment,
//           comment,
//         },
//       });
//       feedbackCount++;

//       if (sentiment === 'NEGATIVE' || (sentiment === 'NEUTRAL' && Math.random() > 0.5)) {
//         const planStatus: ActionPlanStatus = pick(['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED']);

//         let title = '';
//         let description = '';
//         let resolution: string | null = null;

//         if (sentiment === 'NEGATIVE') {
//           title = 'Call customer to apologize and offer compensation';
//           description = 'Customer had a poor experience. Call immediately to apologize, review the delivery process, and offer a 100k voucher.';
//         } else {
//           title = 'Review packaging process';
//           description = 'Feedback about dented box. Notify the shipping partner and warehouse to add extra bubble wrap.';
//         }

//         if (planStatus === 'DONE') {
//           resolution = sentiment === 'NEGATIVE'
//             ? 'Called to apologize. Successfully sent a 100k discount code via email.'
//             : 'Held meeting with warehouse team. Requested 2 extra layers of bubble wrap going forward.';
//         } else if (planStatus === 'REJECTED') {
//           resolution = 'Called 3 times but customer did not answer. Closing task.';
//         }

//         await prisma.feedbackActionPlan.create({
//           data: {
//             feedbackId: fb.id,
//             title,
//             description,
//             status: planStatus,
//             resolution,
//             assigneeId: adminUser.id,
//           },
//         });
//         actionPlanCount++;
//       }
//     }
//   }
//   console.log(`✅ Created ${feedbackCount} feedbacks and ${actionPlanCount} action plans.`);

//   // ── 9. SUMMARY ──────────────────────────────────────────────────────────────
//   const totalOrders    = await prisma.order.count();
//   const totalRevenue   = await prisma.order.aggregate({ where: { status: 'DONE' }, _sum: { total: true } });
//   const totalFeedbacks = await prisma.feedback.count();
//   const totalActionPlans = await prisma.feedbackActionPlan.count();

//   console.log('\n🎉 SEED COMPLETE!');
//   console.log(`   👤 Customers : ${customers.length} + 1 admin`);
//   console.log(`   📦 Products  : ${allProducts.length} across 6 categories`);
//   console.log(`   🛒 Orders    : ${totalOrders} (oldest → newest)`);
//   console.log(`   💰 Revenue   : ${totalRevenue._sum.total?.toLocaleString('en-US')} VND (DONE)`);
//   console.log(`   ⭐ Reviews   : ${totalFeedbacks} (60% positive / 25% neutral / 15% negative)`);
//   console.log(`   🛠️  Plans     : ${totalActionPlans} action plans generated for admin to review`);

//   // ── 10. SYNC VECTORS TO QDRANT ───────────────────────────────────────────────
//   console.log('\n🤖 Bắt đầu đồng bộ vector AI sang Qdrant...');
//   await syncPostgresToQdrant();
// }

// main()
//   .catch((e) => {
//     console.error('❌ Seeding failed:', e);
//     process.exit(1);
//   })
//   .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import process from 'process';
import { syncPostgresToQdrant } from '../src/scripts/sync-qdrant';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const prisma = new PrismaClient();
const paymentTransaction = (prisma as PrismaClient & {
  paymentTransaction: {
    deleteMany: () => Promise<unknown>;
    create: (args: {
      data: {
        orderId: number;
        vnp_TxnRef: string;
        vnp_TransactionNo: string | null;
        vnp_Amount: number;
        vnp_BankCode: string;
        vnp_PayDate: string;
        vnp_ResponseCode: string;
        vnp_TransactionStatus: string;
        isSuccess: boolean;
        rawQuery: { note: string; vnp_OrderInfo: string };
        createdAt: Date;
      };
    }) => Promise<unknown>;
  };
}).paymentTransaction;

function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Tạo ngày ngẫu nhiên trong khoảng [daysBack] ngày trước.
 * Phân phối có trọng số: cuối tuần & tháng 11-12 (mùa sale) có nhiều đơn hơn.
 */
function weightedDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(ri(7, 22), ri(0, 59), ri(0, 59), 0);
  return d;
}

/**
 * Sinh danh sách ngày cho N đơn hàng trải đều 365 ngày,
 * có peak vào: cuối tuần, tháng 11 (Black Friday), tháng 12 (Giáng sinh/Tết).
 */
function generateOrderDates(totalOrders: number): Date[] {
  const today = new Date();
  const dates: Date[] = [];

  // Trọng số theo ngày trong tuần (0=Sun,6=Sat)
  const dowWeight = [1.6, 0.8, 0.8, 0.9, 1.0, 1.3, 1.6];

  // Tạo pool ngày với trọng số
  const dayPool: number[] = []; // số ngày trước hôm nay

  for (let daysBack = 90; daysBack >= 0; daysBack--) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysBack);
    const dow = d.getDay();
    const month = d.getMonth() + 1; // 1-12

    let weight = dowWeight[dow];
    if (month === 11) weight *= 1.8; // Black Friday
    if (month === 12) weight *= 2.0; // Giáng sinh / Tết
    if (month === 1) weight *= 1.5; // Tết Nguyên Đán

    const slots = Math.round(weight * 10);
    for (let s = 0; s < slots; s++) dayPool.push(daysBack);
  }

  for (let i = 0; i < totalOrders; i++) {
    const daysBack = pick(dayPool);
    const d = new Date(today);
    d.setDate(d.getDate() - daysBack);
    d.setHours(ri(7, 22), ri(0, 59), ri(0, 59), 0);
    dates.push(d);
  }

  // Sắp xếp cũ → mới
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}

async function main() {
  console.log('🌱 Starting RICH E-commerce database seeding — 2 YEAR (VND)...');
  const ADMIN_PASSWORD_HASH = '$2b$10$KL6Eu3/ZrUS8kIJ26jwqLOdnqNpVZ2z6eqvd9SlbdjXsX5LxtjKoy';

  // ── 1. CLEANUP ──────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
  TRUNCATE TABLE 
    "FeedbackActionPlan",
    "Feedback",
    "FeedbackType",
    "PaymentTransaction",
    "OrderItem",
    "OrderEvent",
    "Order",
    "Product",
    "Category",
    "StoreSetting",
    "User"
  RESTART IDENTITY CASCADE
`);
  console.log('🧹 Cleared existing records.');

  // ── 2. SYSTEM CONFIG ────────────────────────────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production';

  const systemConfigs = [
    { key: 'jwt_access_expires_in', value: '840', description: 'Access token lifetime (seconds)' },
    { key: 'refresh_token_ttl_seconds', value: '900', description: 'Refresh token lifetime in seconds' },
    { key: 'verify_token_ttl_seconds', value: '180', description: 'Email verification link lifetime in seconds' },
    { key: 'pending_register_ttl_seconds', value: '1800', description: 'Pending registration cleanup TTL in seconds' },
    { key: 'idle_timeout_seconds', value: '900', description: 'Auto logout after user inactivity (seconds, 60–86400)' },
    { key: 'product_cache_ttl_seconds', value: '5', description: 'Product detail Redis cache TTL in seconds (max 3600)' },
    { key: 'checkout_reservation_ttl_seconds', value: '900', description: 'Stock reservation hold time at checkout in seconds (60–3600)' },
    { key: 'use_gemini', value: isProd ? 'true' : 'false', description: 'Use Gemini AI instead of local LLM (true/false)' },
    { key: 'gemini_api_key', value: process.env.GEMINI_API_KEY ?? '', description: 'Gemini API key (leave empty to use local LLM)' },
    { key: 'vnp_return_url', value: isProd ? (process.env.CLIENT_URL ?? 'https://your-app.vercel.app') : 'http://localhost:4200', description: 'VNPay redirect URL after payment' },
  ] as const;

  await (prisma as any).systemConfig.createMany({ data: systemConfigs, skipDuplicates: true });
  console.log('✅ System configs seeded.');

  // ── 3. STORE SETTINGS ───────────────────────────────────────────────────────
  await prisma.storeSetting.create({
    data: {
      name: 'BanDai',
      address: '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City',
      phone: '1800-555-0199',
      email: 'support@technova.demo',
      logoUrl: 'https://i.postimg.cc/nLLk9Cfh/Gemini-Generated-Image-t4b4bet4b4bet4b4-Photoroom.png',
      description: 'Your destination for premium technology and electronics.',
    },
  });

  // ── 4. FEEDBACK TYPES ───────────────────────────────────────────────────────
  const [typeQuality, typeShipping, typeService, typeUnknown] = await Promise.all([
    prisma.feedbackType.create({ data: { name: 'Product quality', description: 'Durability, design, and performance' } }),
    prisma.feedbackType.create({ data: { name: 'Shipping & packaging', description: 'Delivery speed and packaging condition' } }),
    prisma.feedbackType.create({ data: { name: 'Customer service', description: 'Support, communication, and issue resolution' } }),
    prisma.feedbackType.create({ data: { name: 'Unknown', description: 'Fallback when AI cannot determine a category' } }),
  ]);
  const feedbackTypes = [typeQuality, typeShipping, typeService, typeUnknown];
  console.log('✅ Feedback types created.');

  // ── 5. USERS — 1 admin + 30 customers ──────────────────────────────────────
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@admin.com',
      password: ADMIN_PASSWORD_HASH,
      name: 'Administrator',
      role: 'ADMIN',
    },
  });

  const customerData = [
    { name: 'Emily Watson', email: 'emily@example.com', phone: '0901234001', address: '12 Oak Avenue, Austin, TX 78701' },
    { name: 'James Miller', email: 'james@example.com', phone: '0901234002', address: '45 Maple Road, Seattle, WA 98101' },
    { name: 'Sophia Chen', email: 'sophia@example.com', phone: '0901234003', address: '78 Pine Street, Portland, OR 97201' },
    { name: 'Daniel Brooks', email: 'daniel@example.com', phone: '0901234004', address: '23 Cedar Lane, Denver, CO 80202' },
    { name: 'Olivia Grant', email: 'olivia@example.com', phone: '0901234005', address: '56 Birch Drive, Miami, FL 33101' },
    { name: 'Ryan Cooper', email: 'ryan@example.com', phone: '0901234006', address: '34 Elm Court, Chicago, IL 60601' },
    { name: 'Chloe Adams', email: 'chloe@example.com', phone: '0901234007', address: '90 Willow Way, Boston, MA 02108' },
    { name: 'Ethan Parker', email: 'ethan@example.com', phone: '0901234008', address: '11 Ash Boulevard, Atlanta, GA 30303' },
    { name: 'Mia Sullivan', email: 'mia@example.com', phone: '0901234009', address: '67 Spruce Street, Phoenix, AZ 85001' },
    { name: 'Noah Bennett', email: 'noah@example.com', phone: '0901234010', address: '29 Hickory Road, Dallas, TX 75201' },
    { name: 'Ava Richardson', email: 'ava@example.com', phone: '0901234011', address: '8 Cypress Path, San Diego, CA 92101' },
    { name: 'Liam Foster', email: 'liam@example.com', phone: '0901234012', address: '15 Redwood Ave, Los Angeles, CA 90001' },
    { name: 'Grace Hughes', email: 'grace@example.com', phone: '0901234013', address: '52 Magnolia Lane, Nashville, TN 37201' },
    { name: 'Jack Morgan', email: 'jack@example.com', phone: '0901234014', address: '33 Sycamore St, Houston, TX 77001' },
    { name: 'Lily Carter', email: 'lily@example.com', phone: '0901234015', address: '71 Dogwood Circle, Charlotte, NC 28201' },
    { name: 'Henry Ward', email: 'henry@example.com', phone: '0901234016', address: '18 Poplar Drive, Philadelphia, PA 19101' },
    { name: 'Zoe Mitchell', email: 'zoe@example.com', phone: '0901234017', address: '44 Laurel Way, Tampa, FL 33601' },
    { name: 'Owen Hayes', email: 'owen@example.com', phone: '0901234018', address: '62 Juniper Road, Columbus, OH 43201' },
    { name: 'Nora Price', email: 'nora@example.com', phone: '0901234019', address: '5 Chestnut Street, San Francisco, CA 94102' },
    { name: 'Leo Sanders', email: 'leo@example.com', phone: '0901234020', address: '88 Walnut Avenue, Detroit, MI 48201' },
    { name: 'Ella Turner', email: 'ella@example.com', phone: '0901234021', address: '3 Elm Street, Austin, TX 78702' },
    { name: 'Mason Flores', email: 'mason@example.com', phone: '0901234022', address: '9 Oakwood Blvd, Seattle, WA 98102' },
    { name: 'Aria Scott', email: 'aria@example.com', phone: '0901234023', address: '26 Ivy Lane, Portland, OR 97202' },
    { name: 'Lucas Green', email: 'lucas@example.com', phone: '0901234024', address: '41 Fern Avenue, Denver, CO 80203' },
    { name: 'Scarlett King', email: 'scarlett@example.com', phone: '0901234025', address: '55 Maple Drive, Miami, FL 33102' },
    { name: 'Aiden Wright', email: 'aiden@example.com', phone: '0901234026', address: '70 Birch Way, Chicago, IL 60602' },
    { name: 'Luna Baker', email: 'luna@example.com', phone: '0901234027', address: '14 Cedar Court, Boston, MA 02109' },
    { name: 'Jackson Hill', email: 'jackson@example.com', phone: '0901234028', address: '38 Pine Road, Atlanta, GA 30304' },
    { name: 'Violet Nelson', email: 'violet@example.com', phone: '0901234029', address: '22 Oak Circle, Phoenix, AZ 85002' },
    { name: 'Sebastian Ross', email: 'sebastian@example.com', phone: '0901234030', address: '61 Willow Drive, Dallas, TX 75202' },
  ];

  const customers = await Promise.all(
    customerData.map((c) =>
      prisma.user.create({
        data: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          streetAddress: c.address,
          fullAddress: c.address,
          password: 'hashed_pw',
          role: 'USER',
        },
      }),
    ),
  );
  console.log(`✅ Created ${customers.length} customers + 1 admin.`);

  // ── 6. CATEGORIES & PRODUCTS ────────────────────────────────────────────────
  const [catSmartphone, catLaptop, catTablet, catHeadphone, catSmarwatch, catCharger] =
    await Promise.all([
      prisma.category.create({ data: { name: 'Smartphone' } }),
      prisma.category.create({ data: { name: 'Laptop' } }),
      prisma.category.create({ data: { name: 'Tablet' } }),
      prisma.category.create({ data: { name: 'Headphone' } }),
      prisma.category.create({ data: { name: 'Smartwatch' } }),
      prisma.category.create({ data: { name: 'Charger' } }),
    ]);

  const rawProducts = [
    // Smartphone (10)
    { name: 'iPhone 15 Pro Max 256GB', price: 29_990_000, cat: catSmartphone, stock: ri(5, 40), desc: 'Titanium frame, A17 Pro chip, 48MP main camera.' },
    { name: 'iPhone 15 128GB', price: 22_490_000, cat: catSmartphone, stock: ri(10, 60), desc: 'Dynamic Island, USB-C, all-day battery.' },
    { name: 'Samsung Galaxy S24 Ultra 512GB', price: 33_990_000, cat: catSmartphone, stock: ri(5, 25), desc: 'Built-in S Pen, 200MP camera, Galaxy AI.' },
    { name: 'Samsung Galaxy A55 5G 256GB', price: 9_990_000, cat: catSmartphone, stock: ri(20, 80), desc: 'Slim design, 50MP OIS camera, IP67 rating.' },
    { name: 'Google Pixel 8 Pro 128GB', price: 23_990_000, cat: catSmartphone, stock: ri(8, 35), desc: 'Best computational photography on Android.' },
    { name: 'OnePlus 12 5G 256GB', price: 18_990_000, cat: catSmartphone, stock: ri(10, 45), desc: 'Snapdragon 8 Gen 3, 100W SuperVOOC charging.' },
    { name: 'Xiaomi 14 Pro 512GB', price: 26_990_000, cat: catSmartphone, stock: ri(5, 20), desc: 'Leica optics, Snapdragon 8 Gen 3, 120W charging.' },
    { name: 'OPPO Find X7 Ultra 256GB', price: 28_490_000, cat: catSmartphone, stock: ri(3, 15), desc: 'Dual periscope camera, Hasselblad color tuning.' },
    { name: 'Vivo X100 Pro 256GB', price: 25_990_000, cat: catSmartphone, stock: ri(5, 20), desc: 'ZEISS optics, 100W wireless flash charging.' },
    { name: 'Realme GT 6 256GB', price: 13_490_000, cat: catSmartphone, stock: 0, desc: 'Snapdragon 8s Gen 3, 120Hz AMOLED, 120W turbo.' },
    // Laptop (10)
    { name: 'MacBook Pro 14-inch M3 Pro', price: 44_990_000, cat: catLaptop, stock: ri(5, 20), desc: 'M3 Pro chip, 18GB RAM, Liquid Retina XDR display.' },
    { name: 'MacBook Air 15-inch M2', price: 32_990_000, cat: catLaptop, stock: ri(10, 40), desc: 'Fanless design, 18-hour battery, 1080p webcam.' },
    { name: 'Dell XPS 15 9530', price: 38_990_000, cat: catLaptop, stock: ri(5, 25), desc: 'OLED 3.5K touch display, RTX 4060, 13th Gen Intel.' },
    { name: 'Lenovo ThinkPad X1 Carbon Gen 12', price: 36_490_000, cat: catLaptop, stock: ri(8, 30), desc: 'Ultra-light 1.12 kg, vPro, MIL-SPEC certified.' },
    { name: 'ASUS ROG Zephyrus G14 2024', price: 43_990_000, cat: catLaptop, stock: ri(4, 15), desc: 'Ryzen 9 8945HS, RTX 4070, 120Hz OLED panel.' },
    { name: 'HP Spectre x360 14', price: 34_990_000, cat: catLaptop, stock: ri(8, 30), desc: '2-in-1 OLED, Intel Core Ultra 7, OLED pen display.' },
    { name: 'Razer Blade 16 2024', price: 59_990_000, cat: catLaptop, stock: ri(2, 10), desc: 'RTX 4090, dual-mode 240Hz OLED, per-key RGB.' },
    { name: 'MSI Stealth 16 Studio A13V', price: 49_990_000, cat: catLaptop, stock: ri(3, 12), desc: 'RTX 4070, QHD+ 240Hz, Intel Core i9 HX.' },
    { name: 'Acer Swift 14 AI', price: 21_990_000, cat: catLaptop, stock: ri(10, 50), desc: 'Intel Core Ultra 5, NPU for AI tasks, OLED display.' },
    { name: 'LG Gram 17 2024', price: 38_490_000, cat: catLaptop, stock: 0, desc: 'Only 1.35 kg, 17-inch IPS, 22-hour battery life.' },
    // Tablet (8)
    { name: 'iPad Pro 13-inch M4 256GB WiFi', price: 32_990_000, cat: catTablet, stock: ri(5, 20), desc: 'Ultra Retina XDR OLED, M4 chip, under 6mm thin.' },
    { name: 'iPad Air 11-inch M2 128GB WiFi', price: 17_990_000, cat: catTablet, stock: ri(15, 50), desc: 'Powerful M2 chip, supports Apple Pencil Pro.' },
    { name: 'iPad mini 7th Gen 64GB WiFi', price: 13_990_000, cat: catTablet, stock: ri(10, 40), desc: 'Compact 8.3-inch, A17 Pro, USB-C.' },
    { name: 'Samsung Galaxy Tab S9 Ultra 256GB', price: 29_990_000, cat: catTablet, stock: ri(4, 18), desc: '14.6-inch AMOLED, S Pen included, IP68.' },
    { name: 'Samsung Galaxy Tab S9 FE 128GB', price: 10_490_000, cat: catTablet, stock: ri(15, 55), desc: 'Exynos 1380, 45W charging, IP68 durability.' },
    { name: 'Xiaomi Pad 6S Pro 256GB', price: 12_990_000, cat: catTablet, stock: ri(8, 30), desc: 'Snapdragon 8 Gen 2, 144Hz display, 10000mAh.' },
    { name: 'Lenovo Tab P12 Pro 256GB', price: 15_490_000, cat: catTablet, stock: ri(5, 20), desc: '12.6-inch AMOLED, Snapdragon 870, stylus support.' },
    { name: 'Microsoft Surface Pro 10', price: 27_990_000, cat: catTablet, stock: ri(4, 15), desc: 'Intel Core Ultra, detachable keyboard, 13-inch.' },
    // Headphone (8)
    { name: 'Sony WH-1000XM5', price: 8_490_000, cat: catHeadphone, stock: ri(20, 80), desc: 'Industry-leading ANC, 30-hour battery, LDAC.' },
    { name: 'Apple AirPods Pro 2nd Gen', price: 5_990_000, cat: catHeadphone, stock: ri(30, 90), desc: 'Adaptive Audio, H2 chip, MagSafe charging case.' },
    { name: 'Bose QuietComfort Ultra', price: 9_990_000, cat: catHeadphone, stock: ri(10, 40), desc: 'Immersive audio, CustomTune ANC, 24-hour life.' },
    { name: 'Samsung Galaxy Buds3 Pro', price: 4_490_000, cat: catHeadphone, stock: ri(15, 60), desc: 'Blade design, 360° audio, hi-fi 24-bit sound.' },
    { name: 'Jabra Evolve2 85', price: 10_490_000, cat: catHeadphone, stock: ri(5, 25), desc: '10-mic ANC, UC certified, 37-hour battery.' },
    { name: 'Sennheiser Momentum 4 Wireless', price: 8_990_000, cat: catHeadphone, stock: ri(8, 30), desc: 'Crystal-clear sound, 60-hour battery, ANC.' },
    { name: 'Audio-Technica ATH-M50xBT2', price: 3_990_000, cat: catHeadphone, stock: ri(20, 70), desc: 'Studio-reference sound, 50-hour wireless battery.' },
    { name: 'Nothing Ear 2', price: 2_990_000, cat: catHeadphone, stock: 0, desc: 'Transparent design, Hi-Res Audio, LHDC 5.0.' },
    // Smartwatch (7)
    { name: 'Apple Watch Series 10 GPS 46mm', price: 11_990_000, cat: catSmarwatch, stock: ri(10, 40), desc: 'Largest display ever, 30% thinner, sleep apnea detection.' },
    { name: 'Apple Watch Ultra 2', price: 22_990_000, cat: catSmarwatch, stock: ri(3, 12), desc: 'Titanium case, dual-frequency GPS, 60-hour battery.' },
    { name: 'Samsung Galaxy Watch 7 44mm', price: 8_990_000, cat: catSmarwatch, stock: ri(10, 45), desc: 'Advanced BioActive sensor, AI health coaching.' },
    { name: 'Garmin Fenix 8 Solar 47mm', price: 24_990_000, cat: catSmarwatch, stock: ri(3, 12), desc: 'Solar charging, multi-band GPS, AMOLED display.' },
    { name: 'Garmin Venu 3', price: 11_490_000, cat: catSmarwatch, stock: ri(8, 30), desc: 'AMOLED display, wheelchair activity tracking, Nap detection.' },
    { name: 'Fitbit Sense 3', price: 5_990_000, cat: catSmarwatch, stock: ri(15, 55), desc: 'ECG sensor, EDA scan, skin temperature, SpO2.' },
    { name: 'Amazfit GTR 4', price: 3_490_000, cat: catSmarwatch, stock: ri(20, 70), desc: '150+ sports modes, 14-day battery, dual-band GPS.' },
    // Charger (7)
    { name: 'Anker Prime 27650mAh Power Bank', price: 4_990_000, cat: catCharger, stock: ri(30, 80), desc: '250W output, charge 3 devices simultaneously.' },
    { name: 'Anker 737 GaN Charger 120W', price: 2_490_000, cat: catCharger, stock: ri(30, 90), desc: '3-port GaN, charges laptop + phone + tablet at once.' },
    { name: 'Ugreen Nexode 100W GaN Charger', price: 1_390_000, cat: catCharger, stock: 7, desc: '4-port ultra-compact, universal compatibility.' },
    { name: 'Baseus 65W USB-C GaN Charger', price: 890_000, cat: catCharger, stock: ri(40, 100), desc: 'Foldable pins, PD 3.0, supports MacBook Air.' },
    { name: 'Apple MagSafe Charger 1m', price: 990_000, cat: catCharger, stock: ri(30, 80), desc: 'Magnetic alignment, 15W fast wireless charging.' },
    { name: 'Xiaomi 67W Turbo Charging Kit', price: 690_000, cat: catCharger, stock: ri(40, 100), desc: 'Includes turbo charger brick and USB-C cable.' },
    { name: 'Samsung 25W Super Fast Charger', price: 590_000, cat: catCharger, stock: ri(50, 120), desc: 'USB-C PD, compatible with Galaxy S and Note series.' },
  ];

  await prisma.product.createMany({
    data: rawProducts.map((p, i) => ({
      name: p.name,
      title_unaccent: removeAccents(p.name),
      description: p.desc,
      price: p.price,
      stock: p.stock,
      imageUrl: (() => {
        const catId = p.cat.id;
        if (catId === catSmartphone.id) return 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcR7AJq9rOPmTE-DzPkDzybKEPU43HP5NKmFvROAFCrN3NodUUe3FXr28y60yqneGvoPTfUIkF2PuzdE-kBg4g3PqDJ0k6XpXsjXEhmMbkBuJHDiQMNB3fIToeGmX2Pge2zPGQ&usqp=CAc';
        if (catId === catLaptop.id) return 'https://surfaceviet.vn/wp-content/uploads/2024/05/Surface-Laptop-7-Black-13.8-inch.jpg';
        if (catId === catTablet.id) return 'https://lapvip.vn/upload/filters_img/thumb_350x0/1107-2-1722567148.jpg';
        if (catId === catHeadphone.id) return 'https://down-vn.img.susercontent.com/file/vn-11134207-7ra0g-m9d1mhxlbds700_tn';
        if (catId === catSmarwatch.id) return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOwR7zjuZ_6KQ2UGvhbW34oxIEcoSUQaiWfA&s';
        if (catId === catCharger.id) return 'https://bizweb.dktcdn.net/100/444/581/products/1-jpeg-7a7668dc-b7d3-46a2-b0e6-19caaef682f1.jpg?v=1641360367993';
        return `https://via.placeholder.com/300x300/F3F4F6/333333/?text=Product+${i + 1}`;
      })(),
      status: 'AVAILABLE' as const,
      categoryId: p.cat.id,
    })),
  });

  const allProducts = await prisma.product.findMany({ orderBy: { id: 'asc' } });
  console.log(`✅ Created 6 categories and ${allProducts.length} products.`);

  // ── 7. ORDERS — 500 orders trải đều 365 ngày ────────────────────────────────
  const TOTAL_ORDERS = 120;

  // Phân phối trạng thái: 65% DONE, 15% SHIPPING, 10% CONFIRMED, 6% PENDING, 4% CANCELLED
  type OrderStatus = 'DONE' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'CANCELLED';
  type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

  const statusPool: OrderStatus[] = [
    ...Array<OrderStatus>(325).fill('DONE'),
    ...Array<OrderStatus>(75).fill('SHIPPING'),
    ...Array<OrderStatus>(50).fill('CONFIRMED'),
    ...Array<OrderStatus>(30).fill('PENDING'),
    ...Array<OrderStatus>(20).fill('CANCELLED'),
  ];

  const orderDates = generateOrderDates(TOTAL_ORDERS);

  // Tạo từng batch 10 orders để tránh timeout (Neon free tier connection limit)
  const BATCH = 10;
  let created = 0;

  for (let i = 0; i < TOTAL_ORDERS; i += BATCH) {
    const batchDates = orderDates.slice(i, i + BATCH);

    for (const orderDate of batchDates) {
      const customer = pick(customers);
      const rawStatus = pick(statusPool);
      const status: 'PENDING' | 'DONE' | 'CANCELLED' =
        rawStatus === 'PENDING' ? 'PENDING' :
          rawStatus === 'CANCELLED' ? 'CANCELLED' :
            'DONE';

      const paymentStatus: PaymentStatus =
        status === 'DONE' ? 'PAID' :
          status === 'CANCELLED' ? 'FAILED' :
            pick(['PENDING', 'PAID']);

      const itemCount = ri(1, 4);
      const chosenProds = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, itemCount);
      const items = chosenProds.map((p) => ({
        productId: p.id,
        quantity: ri(1, 3),
        unitPrice: p.price,
      }));
      const total = items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

      const order = await prisma.order.create({
        data: {
          userId: customer.id,
          status,
          paymentStatus,
          total,
          shippingAddress: customer.fullAddress ?? customer.streetAddress ?? '',
          createdAt: orderDate,
          items: { create: items },
          events: {
            create: [
              {
                type: 'ORDER_STATUS_CHANGED',
                newValue: 'PENDING',
                note: 'Customer placed order successfully',
                changedById: customer.id,
                changedByRole: 'USER',
                createdAt: orderDate,
              },
            ],
          },
        } as any,
      });

      if (status !== 'PENDING') {
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'ORDER_STATUS_CHANGED',
            oldValue: 'PENDING',
            newValue: status,
            changedById: adminUser.id,
            changedByRole: 'ADMIN',
            note:
              status === 'CANCELLED'
                ? 'Order cancelled due to payment timeout or system request'
                : 'Admin confirmed and started processing the order',
            createdAt: new Date(orderDate.getTime() + ri(1, 24) * 60 * 60 * 1000),
          },
        });
      }

      if (paymentStatus !== 'PENDING') {
        const isSuccess = paymentStatus === 'PAID';
        const txnRef = `u${customer.id}-${order.id}-${orderDate.getTime()}`;

        await paymentTransaction.create({
          data: {
            orderId: order.id,
            vnp_TxnRef: txnRef,
            vnp_TransactionNo: isSuccess ? String(ri(10000000, 99999999)) : null,
            vnp_Amount: total,
            vnp_BankCode: pick(['NCB', 'AGRIBANK', 'SCB', 'VISA']),
            vnp_PayDate: orderDate.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14),
            vnp_ResponseCode: isSuccess ? '00' : pick(['24', '51', '10']),
            vnp_TransactionStatus: isSuccess ? '00' : '02',
            isSuccess,
            rawQuery: {
              note: 'Generated by seed script',
              vnp_OrderInfo: `Thanh toan don hang ${order.id}`,
            },
            createdAt: orderDate,
          },
        });

        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'PAYMENT_STATUS_CHANGED',
            oldValue: 'PENDING',
            newValue: isSuccess ? 'PAID' : 'FAILED',
            note: isSuccess
              ? `Payment successful via VNPay gateway`
              : `Payment failed - VNPay error code: ${pick(['24', '51', '10'])}`,
            createdAt: new Date(orderDate.getTime() + ri(1, 30) * 60 * 1000),
          },
        });
      }
    }

    created += batchDates.length;
    process.stdout.write(`\r   Orders & Transactions created: ${created}/${TOTAL_ORDERS}`);
    await delay(200);
  }
  console.log(`\n✅ Created ${TOTAL_ORDERS} orders and seeded VNPay transactions across 730 days.`);

  // ── 8. FEEDBACKS & ACTION PLANS (~70% of DONE orders) ───────────────────────
  const doneOrders = await prisma.order.findMany({
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
    'Absolutely love this product, using it every day.',
    'Packaging was pristine and setup was effortless.',
    'Received it a day early — great logistics!',
  ];
  const neutralComments = [
    'It is fine and usable, nothing standout.',
    'Arrived one day late but the item was OK.',
    'Outer box was a bit dented but product inside was intact.',
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

  const sentimentPool = [
    ...Array<'POSITIVE'>(60).fill('POSITIVE'),
    ...Array<'NEUTRAL'>(25).fill('NEUTRAL'),
    ...Array<'NEGATIVE'>(15).fill('NEGATIVE'),
  ];

  type ActionPlanStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

  let feedbackCount = 0;
  let actionPlanCount = 0;
  let fbBatch: any[] = [];

  // Track (orderId, productId) pairs to avoid unique constraint violations
  const seenFbKeys = new Set<string>();

  for (const order of doneOrders) {
    if (Math.random() > 0.70) continue;
    const itemsToReview = [...order.items].sort(() => 0.5 - Math.random()).slice(0, ri(1, 2));

    for (const item of itemsToReview) {
      const key = `${order.id}-${item.productId}`;
      if (seenFbKeys.has(key)) continue;
      seenFbKeys.add(key);

      const sentiment = pick(sentimentPool);
      const rating = sentiment === 'POSITIVE' ? ri(4, 5) : sentiment === 'NEUTRAL' ? 3 : ri(1, 2);
      const comment = sentiment === 'POSITIVE' ? pick(positiveComments) : sentiment === 'NEUTRAL' ? pick(neutralComments) : pick(negativeComments);

      const fb = await prisma.feedback.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          productId: item.productId,
          typeId: pick(feedbackTypes).id,
          rating,
          sentiment,
          comment,
        },
      });
      feedbackCount++;

      if (sentiment === 'NEGATIVE' || (sentiment === 'NEUTRAL' && Math.random() > 0.5)) {
        const planStatus: ActionPlanStatus = pick(['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED']);
        const isNeg = sentiment === 'NEGATIVE';

        await prisma.feedbackActionPlan.create({
          data: {
            feedbackId: fb.id,
            title: isNeg ? 'Call customer to apologize and offer compensation' : 'Review packaging process',
            description: isNeg
              ? 'Customer had a poor experience. Call immediately to apologize, review delivery process, and offer a 100k voucher.'
              : 'Feedback about dented box. Notify shipping partner and warehouse to add extra bubble wrap.',
            status: planStatus,
            resolution:
              planStatus === 'DONE'
                ? (isNeg ? 'Called to apologize. Successfully sent a 100k discount code via email.' : 'Held meeting with warehouse team. Requested 2 extra layers of bubble wrap.')
                : planStatus === 'REJECTED'
                  ? 'Called 3 times but customer did not answer. Closing task.'
                  : null,
            assigneeId: adminUser.id,
          },
        });
        actionPlanCount++;
      }

      if (feedbackCount % 100 === 0) {
        process.stdout.write(`\r   Feedbacks created: ${feedbackCount}`);
      }
    }
  }
  console.log(`\n✅ Created ${feedbackCount} feedbacks and ${actionPlanCount} action plans.`);

  // ── 9. SUMMARY ──────────────────────────────────────────────────────────────
  const totalOrders = await prisma.order.count();
  const totalRevenue = await prisma.order.aggregate({ where: { status: 'DONE' }, _sum: { total: true } });
  const totalFeedbacks = await prisma.feedback.count();
  const totalActionPlans = await prisma.feedbackActionPlan.count();

  console.log('\n🎉 SEED COMPLETE — 2 YEARS OF DATA!');
  console.log(`   👤 Customers   : ${customers.length} + 1 admin`);
  console.log(`   📦 Products    : ${allProducts.length} across 6 categories`);
  console.log(`   🛒 Orders      : ${totalOrders} (spread over 730 days, peak Nov/Dec/Jan)`);
  console.log(`   💰 Revenue     : ${totalRevenue._sum.total?.toLocaleString('en-US')} VND (DONE)`);
  console.log(`   ⭐ Reviews     : ${totalFeedbacks} feedbacks`);
  console.log(`   🛠️  Plans       : ${totalActionPlans} action plans`);

  console.log('\n🤖 Syncing vectors to Qdrant...');
  await syncPostgresToQdrant();
}

main()
  .catch((e) => { console.error('❌ Seeding failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());