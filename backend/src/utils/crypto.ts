import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY as string;
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_PREFIX = 'enc:v1:';

// Fail-fast ngay lúc startup để tránh silent failures
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('CRITICAL: APP_ENCRYPTION_KEY must be a 64-character hex string in environment variables.');
}

export function encryptValue(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${encrypted}:${authTag}`;
}

export function decryptValue(text: string): string {
  // Backward compatibility rõ ràng và an toàn
  if (!text.startsWith(ENCRYPTED_PREFIX)) return text;

  const raw = text.slice(ENCRYPTED_PREFIX.length);

  try {
    const [ivHex, encryptedHex, authTagHex] = raw.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    throw new Error('CRITICAL: Decryption failed. The APP_ENCRYPTION_KEY might have been changed or data is corrupted.');
  }
}
