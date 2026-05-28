# 🗂️ Kế Hoạch Migration Storage Tương Lai

> **Tại sao document này tồn tại?**
> Sau khi refactor (Task 4.4 — Round 11), hệ thống đã chuyển sang lưu **S3 Key** thay vì Full URL trong Database. Quyết định kiến trúc này mở ra khả năng migration mà không cần downtime và không cần động vào dữ liệu hiện có.

---

## ✅ Tình Trạng Hiện Tại (Baseline)

| Thành phần | Giá trị |
|---|---|
| **DB lưu** | S3 Key thuần túy: `products/uuid.webp` |
| **Bucket hiện tại** | `ecommerce-products` (ap-southeast-1) |
| **CDN** | CloudFront (env: `CLOUDFRONT_URL`) |
| **Resolver** | `resolveImageUrl(key)` tại `backend/src/config/storage.ts` |
| **Data cũ (legacy)** | Full URL — được resolver detect và pass-through tự động |

**Trạng thái:** Hệ thống hoàn toàn trơn tru. Mọi thay đổi về hạ tầng storage trong tương lai chỉ cần thao tác tại **1 điểm duy nhất**.

---

## 🎯 Kịch Bản 1 — Đổi CloudFront Domain

**Trigger:** Muốn dùng custom domain (`cdn.yourdomain.com`) thay cho domain CloudFront mặc định.

**Cần làm:**
1. Cập nhật biến môi trường `CLOUDFRONT_URL` trên EC2:
   ```bash
   # Trong .env.production trên EC2
   CLOUDFRONT_URL=https://cdn.yourdomain.com
   ```
2. `pm2 reload` — **XONG**. Không cần sửa code, không cần migration DB.

**Thời gian thực hiện:** < 5 phút.

---

## 🎯 Kịch Bản 2 — Đổi S3 Region (vd: sang ap-northeast-1 — Tokyo)

**Trigger:** Muốn giảm latency cho user Nhật Bản, hoặc AWS thay đổi pricing theo region.

**Bước 1 — Chuẩn bị Bucket mới (không downtime):**
```bash
# Tạo bucket mới ở region mới
aws s3 mb s3://ecommerce-products-tokyo --region ap-northeast-1

# Sync toàn bộ object từ bucket cũ sang mới
aws s3 sync s3://ecommerce-products s3://ecommerce-products-tokyo --region ap-northeast-1
```

**Bước 2 — Cập nhật CloudFront Origin** (AWS Console):
- Trỏ CloudFront Distribution Origin sang bucket mới.
- Verify ảnh vẫn load qua CDN URL cũ (key vẫn giữ nguyên: `products/uuid.webp`).

**Bước 3 — Cập nhật env:**
```bash
AWS_BUCKET_NAME=ecommerce-products-tokyo
AWS_REGION=ap-northeast-1
```

**Bước 4 — `pm2 reload`** — **XONG**.

> [!NOTE]
> Vì DB chỉ lưu **key** (`products/uuid.webp`), không lưu bucket name hay region, nên không cần chạy bất kỳ SQL UPDATE nào. Toàn bộ data cũ tự động hoạt động với bucket mới.

---

## 🎯 Kịch Bản 3 — Migrate sang Storage Provider Khác (vd: Cloudflare R2, GCS)

**Trigger:** Chi phí AWS S3 Egress quá cao, muốn chuyển sang Cloudflare R2 (miễn phí Egress).

**Bước 1 — Sync dữ liệu sang R2:**
```bash
# Dùng rclone để sync
rclone sync s3:ecommerce-products r2:ecommerce-products --progress
```

**Bước 2 — Cập nhật `storage.ts`:**
```typescript
// Thay s3Client bằng R2 client (compatible S3 API)
export const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // https://xxx.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
```

**Bước 3 — Cập nhật env:**
```bash
CLOUDFRONT_URL=https://pub-xxx.r2.dev   # hoặc custom domain của R2
AWS_BUCKET_NAME=ecommerce-products
```

**Bước 4 — Deploy + `pm2 reload`** — **XONG**.

> [!IMPORTANT]
> Cloudflare R2 tương thích 100% S3 API — `PutObjectCommand`, `DeleteObjectCommand`, `getSignedUrl` hoạt động y hệt. Không cần thay đổi logic upload.

---

## 🎯 Kịch Bản 4 — Cần Viết Script Migration DB (Data Cũ Legacy)

Dành cho trường hợp hiếm: bạn muốn **dọn dẹp data cũ** (những record còn lưu Full URL từ trước Task 4.4) để DB hoàn toàn thuần key.

**Script migration (chạy 1 lần trên DB):**

```typescript
// scripts/migrate-image-url-to-key.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Các prefix cần tách bỏ để lấy key
const PREFIXES_TO_STRIP = [
  process.env.CLOUDFRONT_URL,
  `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`,
].filter(Boolean) as string[];

function extractKey(fullUrl: string): string | null {
  for (const prefix of PREFIXES_TO_STRIP) {
    if (fullUrl.startsWith(prefix)) {
      return fullUrl.slice(prefix.length).replace(/^\//, '');
    }
  }
  return null; // Không nhận ra prefix — giữ nguyên
}

async function migrate() {
  const products = await prisma.product.findMany({
    where: { imageUrl: { startsWith: 'http' } },
    select: { id: true, imageUrl: true },
  });

  console.log(`Found ${products.length} products with legacy full URL.`);

  for (const p of products) {
    if (!p.imageUrl) continue;
    const key = extractKey(p.imageUrl);
    if (!key) {
      console.warn(`  ⚠️  Cannot extract key from: ${p.imageUrl} — skipping`);
      continue;
    }
    await prisma.product.update({
      where: { id: p.id },
      data: { imageUrl: key },
    });
    console.log(`  ✅ #${p.id}: ${p.imageUrl} → ${key}`);
  }

  console.log('Migration complete.');
  await prisma.$disconnect();
}

migrate().catch(console.error);
```

**Chạy script:**
```bash
npx dotenv-cli -e .env.production -- npx ts-node scripts/migrate-image-url-to-key.ts
```

> [!CAUTION]
> **Backup DB trước khi chạy.** Mặc dù script có kiểm tra và skip record không nhận ra, vẫn nên snapshot Neon trước khi thực thi trên Production.

---

## 📊 Tóm Tắt: Mức Độ Phức Tạp Từng Kịch Bản

| Kịch bản | Thay đổi Code | Thay đổi DB | Downtime | Thời gian ước tính |
|---|---|---|---|---|
| Đổi CloudFront domain | ❌ Không | ❌ Không | ❌ Không | < 5 phút |
| Đổi S3 Region | ❌ Không | ❌ Không | ❌ Không | 30 phút (sync) |
| Migrate sang R2/GCS | ✅ Nhỏ (client config) | ❌ Không | ❌ Không | 1-2 giờ |
| Dọn dẹp legacy URL | ❌ Không | ✅ Script 1 lần | ❌ Không | 15 phút |

> [!TIP]
> **Kết luận kiến trúc:** Việc lưu S3 Key thay vì Full URL là quyết định đúng đắn nhất bạn có thể làm cho một hệ thống Storage. Toàn bộ complexity của việc "ở đâu, domain nào, provider nào" được đóng gói hoàn toàn trong `resolveImageUrl()` và biến môi trường — hai thứ dễ thay đổi nhất trong toàn bộ hệ thống.
