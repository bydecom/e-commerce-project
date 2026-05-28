import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT }),
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'admin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'password123',
  },
});

export const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'ecommerce-products';

/**
 * Resolves a stored image key (e.g. "products/uuid.webp") to a full public URL.
 * Also handles legacy data that was stored as a full URL — returns it as-is.
 */
export function resolveImageUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  // Legacy data: already a full URL — return as-is for backward compatibility
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const base = process.env.CLOUDFRONT_URL
    ?? (process.env.AWS_ENDPOINT
      ? `${process.env.AWS_ENDPOINT}/${BUCKET_NAME}`
      : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION ?? 'ap-southeast-1'}.amazonaws.com`);
  return `${base}/${key}`;
}
