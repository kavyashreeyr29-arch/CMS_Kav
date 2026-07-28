import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const EXPIRES_IN_SECONDS = 900;

/**
 * Real S3-compatible object storage (LLD §1, §8) — MinIO locally, swap in
 * actual S3/R2 credentials in production, nothing else changes since it's
 * all behind this one client.
 *
 * The backend never touches file bytes: it only signs PUT/GET URLs, and the
 * browser talks to the object store directly. That means `S3_ENDPOINT` must
 * be a browser-reachable address (see backend/.env.example) even though
 * that looks unusual for a server-side client.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const s3Config = this.config.get('s3');
    this.bucket = s3Config.bucket;
    this.client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });
  }

  buildStorageKey(scope: 'tickets' | 'projects' | 'sla-policies', ownerId: string, fileName: string): string {
    return `${scope}/${ownerId}/${randomUUID()}-${fileName}`;
  }

  /** Time-limited upload URL the client PUTs the file bytes to directly. */
  async getUploadUrl(storageKey: string): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: storageKey });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: EXPIRES_IN_SECONDS });
    return { uploadUrl, expiresInSeconds: EXPIRES_IN_SECONDS };
  }

  /** Time-limited download URL — never a permanent public URL (LLD §8). */
  async getDownloadUrl(storageKey: string): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: storageKey });
    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn: EXPIRES_IN_SECONDS });
    return { downloadUrl, expiresInSeconds: EXPIRES_IN_SECONDS };
  }
}
