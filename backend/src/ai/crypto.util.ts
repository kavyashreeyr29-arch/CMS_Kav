import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// KMS envelope encryption is the production target (LLD §8); this is the
// local stand-in — AES-256-GCM with a key derived from AI_ENCRYPTION_KEY.
// Swap deriveKey()/encrypt()/decrypt() for actual KMS calls when available.
// The API key is decrypted only in-memory at call time and never logged or
// returned by any GET endpoint (write-only field).

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'elevatohub-ai-provider-configs', 32);
}

export function encryptApiKey(plaintext: string, secret: string): Buffer {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptApiKey(payload: Buffer, secret: string): string {
  const key = deriveKey(secret);
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
