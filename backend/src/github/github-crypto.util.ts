import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Same AES-256-GCM envelope as ai/crypto.util.ts, with a GitHub-specific salt
// for domain separation so a leaked AI ciphertext can't be decrypted as a
// GitHub token or vice versa. The GitHub personal-access-token is decrypted
// only in-memory at REST-call time and never returned by any GET endpoint.
function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'elevatohub-github-integration', 32);
}

export function encryptToken(plaintext: string, secret: string): Buffer {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptToken(payload: Buffer, secret: string): string {
  const key = deriveKey(secret);
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
