# 🔍 AWS Scale Risk Audit — Rà Soát Các Điểm Vỡ Khi Scale/Migrate

> **Trigger:** Sau khi hoàn thành Task 4.2 (S3 OAC + Block Public Access), tiến hành quét toàn bộ codebase để tìm các điểm cứng liên quan đến AWS có thể bị vỡ khi đổi region, đổi bucket, đổi CloudFront distribution.
> **Thời điểm:** Round 11 — 2026-05-28

---

## 🔴 VẤN ĐỀ CẦN SỬA — Hardcoded trong source code

### 1. `deploy-frontend.yml:53` — CloudFront Smoke Test URL hardcoded

**File:** `.github/workflows/deploy-frontend.yml`
```yaml
# HIỆN TẠI — hardcoded, sẽ vỡ nếu đổi CloudFront distribution:
curl -f --retry 3 https://d7ozoo9vtkn42.cloudfront.net || exit 1
```

**Vấn đề:** CloudFront Distribution domain (`d7ozoo9vtkn42.cloudfront.net`) được hardcode thẳng vào CI/CD script. Khi:
- Xóa và tạo lại CloudFront distribution → domain đổi → smoke test luôn fail → deploy block.
- Chuyển sang custom domain (e.g. `shop.bandai.com`) → URL này vẫn tồn tại nhưng không còn là "nguồn sự thật".

**Fix:** Dùng GitHub Secret `CLOUDFRONT_DOMAIN` thay thế:
```yaml
curl -f --retry 3 https://${{ secrets.CLOUDFRONT_DOMAIN }} || exit 1
```

---

### 2. `environment.prod.ts:4` — CloudFront URL hardcoded trong Angular build

**File:** `frontend/src/environments/environment.prod.ts`
```typescript
// HIỆN TẠI:
storageUrl: 'https://da3b96ethakwq.cloudfront.net',
```

**Vấn đề:** Frontend build Angular sẽ bundle URL này thẳng vào `main.js`. Khi đổi CloudFront distribution → **buộc phải rebuild và redeploy toàn bộ frontend** chỉ để thay 1 URL. Không có cơ chế override runtime.

**Mức độ rủi ro:** 🔴 Cao — Đây là trường hợp tương tự `imageUrl` lưu Full URL. Mỗi lần đổi CDN = 1 frontend deploy.

**Fix đề xuất — 2 phương án:**

**Phương án A (Angular environment injection, phổ biến nhất):** Tiếp tục dùng environment file nhưng đảm bảo đây là nơi duy nhất được thay đổi. Khi migrate CDN → chỉ sửa 1 dòng này + rebuild.

**Phương án B (Runtime config, enterprise hơn):** Tạo `assets/config.json` được serve riêng, Angular đọc khi khởi động (không bundle vào JS). Đổi CDN chỉ cần đổi file JSON trên S3, **không cần rebuild Angular**.

> **Khuyến nghị hiện tại:** Chấp nhận Phương án A. Khi có custom domain ổn định (`shop.bandai.com`) → URL sẽ không bao giờ thay đổi. Phương án B chỉ cần khi scale lên multi-tenant hoặc dynamic CDN.

---

## 🟡 CHÚ Ý — Không vỡ ngay, nhưng cần ghi nhận

### 3. `storage.ts:4` — Region fallback không nhất quán

**File:** `backend/src/config/storage.ts`
```typescript
// S3Client dùng:
region: process.env.AWS_REGION || 'us-east-1',

// resolveImageUrl fallback URL dùng:
`https://...s3.${process.env.AWS_REGION ?? 'ap-southeast-1'}.amazonaws.com`
```

**Vấn đề:** 2 fallback region khác nhau trong cùng 1 file:
- S3Client: fallback `us-east-1`  
- resolveImageUrl URL builder: fallback `ap-southeast-1`

Nếu `AWS_REGION` không được set (ví dụ local dev quên) → S3Client kết nối `us-east-1` nhưng URL trả về là `ap-southeast-1` → ảnh 404.

**Fix:** Đồng nhất fallback:
```typescript
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1'; // 1 nguồn sự thật
```

### 4. `upload.service.ts:21` — S3 fallback URL build khi `CLOUDFRONT_URL` không có

```typescript
: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
```

Nếu `AWS_REGION` không được set → URL thành `https://ecommerce-products.s3.undefined.amazonaws.com/...` → broken URL.

**Fix:** Dùng `process.env.AWS_REGION || 'us-east-1'` thay vì bare `process.env.AWS_REGION`.

---

## 🟢 ỔN — Đã được thiết kế tốt

### ✅ CI/CD Frontend Pipeline — Dùng Secrets

```yaml
aws-region: ${{ secrets.AWS_REGION }}
aws s3 sync ... s3://${{ secrets.S3_FRONTEND_BUCKET }} --delete
aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }}
```
Bucket, region, distribution ID đều đã là GitHub Secrets → đổi infrastructure chỉ cần cập nhật Secrets.

### ✅ Backend Storage Config — Env vars qua `storage.ts`

`BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_URL`, `AWS_ENDPOINT` đều đọc từ env vars. Không có giá trị thật nào hardcode.

### ✅ `storageUrl` trong frontend — Chỉ dùng ở 1 nơi

`environment.storageUrl` chỉ được tham chiếu qua Angular environment injection, không bị rải khắp codebase.

### ✅ S3 Key-based Storage (Task 4.4)

DB lưu key, backend resolve URL → đổi CDN không cần SQL migration.

---

## 📋 Bảng Tổng Hợp

| # | Vị trí | Vấn đề | Rủi ro | Cần sửa? |
|---|---|---|---|---|
| 1 | `deploy-frontend.yml:53` | Smoke test URL hardcoded | 🔴 Cao | **Có — đổi thành Secret** |
| 2 | `environment.prod.ts:4` | CloudFront URL bundle vào Angular build | 🟡 Trung bình | Chấp nhận khi chưa có custom domain |
| 3 | `storage.ts` — 2 fallback region khác nhau | `us-east-1` vs `ap-southeast-1` | 🟡 Thấp | **Có — đồng nhất lại** |
| 4 | `upload.service.ts:21` — region undefined | URL thành `s3.undefined.amazonaws.com` | 🟡 Thấp | **Có — thêm fallback** |

---

## 🛠️ Fix Items 1, 3, 4 (Code changes)

### Fix 1: `deploy-frontend.yml`
```yaml
# Thêm secret CLOUDFRONT_DOMAIN vào GitHub Secrets
curl -f --retry 3 https://${{ secrets.CLOUDFRONT_DOMAIN }} || exit 1
```

### Fix 3 + 4: `storage.ts`
```typescript
// Thêm 1 constant tái sử dụng:
const REGION = process.env.AWS_REGION || 'us-east-1';

export const s3Client = new S3Client({
  region: REGION,
  ...
});

// Trong resolveImageUrl:
: `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com`);
```

### Fix 4: `upload.service.ts`
```typescript
import { s3Client, BUCKET_NAME, REGION } from '../../config/storage'; // export REGION từ storage.ts
// hoặc inline:
: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
```
