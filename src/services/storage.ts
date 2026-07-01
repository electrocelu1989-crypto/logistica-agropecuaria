import { Client as MinioClient } from "minio";
import fs from "fs";
import path from "path";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = Number(process.env.MINIO_PORT) || 9000;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "minioadmin";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "comprobantes";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";

let minioClient: MinioClient | null = null;

function getMinioClient(): MinioClient {
  if (!minioClient) {
    minioClient = new MinioClient({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

async function ensureBucket(): Promise<void> {
  try {
    const exists = await getMinioClient().bucketExists(MINIO_BUCKET);
    if (!exists) {
      await getMinioClient().makeBucket(MINIO_BUCKET);
    }
  } catch {
    // MinIO may not be running — will fall back to local storage
  }
}

export async function storeFile(
  buffer: Buffer,
  originalName: string,
  tripId: string,
  tipo: string,
): Promise<string> {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `comprobantes/${tripId}/${tipo}_${timestamp}_${safeName}`;

  // Try MinIO
  try {
    await ensureBucket();
    await getMinioClient().putObject(MINIO_BUCKET, storagePath, buffer);
    const portSuffix = MINIO_PORT !== 80 && MINIO_PORT !== 443 ? `:${MINIO_PORT}` : "";
    return `http://${MINIO_ENDPOINT}${portSuffix}/${MINIO_BUCKET}/${storagePath}`;
  } catch {
    console.warn("MinIO unavailable, falling back to local storage.");
  }

  // Fallback: local uploads/
  const localDir = path.join(process.cwd(), "uploads", tripId);
  fs.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, `${tipo}_${timestamp}_${safeName}`);
  fs.writeFileSync(localPath, buffer);
  return `/uploads/${tripId}/${tipo}_${timestamp}_${safeName}`;
}
