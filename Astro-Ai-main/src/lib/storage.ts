import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Base directory for all uploaded assets (kept isolated from public static folder)
const STORAGE_BASE_DIR = path.join(process.cwd(), 'uploads');
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Checks whether Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

// Ensure category directories exist for local fallback
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Uploads a Base64 image payload to Cloudinary via signed REST API.
 * Never exposes the API secret to the client.
 */
async function uploadToCloudinary(
  dataUri: string,
  category: 'students' | 'attendance',
  bufferLength: number,
  mimeType: string
): Promise<{ url: string; filename: string; size: number; mimeType: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY!.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET!.trim();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `astro/${category}`;

  // Cloudinary signature requires parameters sorted alphabetically
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', dataUri);
  formData.append('folder', folder);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || errorDetail;
    } catch {
      // use status text
    }
    throw new Error(`Cloudinary upload failed: ${errorDetail}`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error('Cloudinary response missing secure_url');
  }

  return {
    url: data.secure_url,
    filename: data.public_id || `cloudinary_${Date.now()}`,
    size: data.bytes || bufferLength,
    mimeType,
  };
}

/**
 * Validates and saves a Base64 data URI image into persistent storage.
 * - In production with Cloudinary configured: uploads to Cloudinary CDN.
 * - In local development / offline testing: stores to local uploads directory.
 * Returns the public image URL path.
 */
export async function saveBase64Image(
  dataUri: string,
  category: 'students' | 'attendance' = 'students',
  prefix: string = ''
): Promise<{ url: string; filename: string; size: number; mimeType: string }> {
  if (!dataUri || typeof dataUri !== 'string') {
    throw new Error('Invalid image payload: string expected');
  }

  // Parse Data URI: data:image/jpeg;base64,....
  const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid Base64 Data URI format');
  }

  const mimeType = matches[1].toLowerCase().trim();
  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) {
    throw new Error(`Unsupported image MIME type: ${mimeType}. Allowed: JPEG, PNG, WebP.`);
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image size (${Math.round(buffer.length / 1024)} KB) exceeds 5MB limit.`);
  }

  // 1. Cloudinary upload path (Production)
  if (isCloudinaryConfigured()) {
    return await uploadToCloudinary(dataUri, category, buffer.length, mimeType);
  }

  // 2. Local filesystem storage path (Development & offline test suite fallback)
  const categoryDir = path.join(STORAGE_BASE_DIR, category);
  ensureDir(categoryDir);

  // Generate safe unique filename to avoid collision & path traversal
  const safePrefix = prefix ? prefix.replace(/[^a-zA-Z0-9_-]/g, '') + '_' : '';
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const filename = `${safePrefix}${Date.now()}_${randomSuffix}${ext}`;
  const filePath = path.join(categoryDir, filename);

  // Security check: verify canonical path is inside category directory
  if (!filePath.startsWith(categoryDir)) {
    throw new Error('Path traversal detected');
  }

  await fs.promises.writeFile(filePath, buffer);

  const url = `/api/storage/${category}/${filename}`;
  return {
    url,
    filename,
    size: buffer.length,
    mimeType,
  };
}

/**
 * Safely deletes a stored image file from Cloudinary or local disk.
 */
export async function deleteStoredImage(
  fileUrlOrName: string,
  category: 'students' | 'attendance' = 'students'
): Promise<boolean> {
  if (!fileUrlOrName) return false;

  // 1. Cloudinary deletion path
  const isCloudinaryUrl =
    fileUrlOrName.includes('cloudinary.com') ||
    fileUrlOrName.startsWith('http://') ||
    fileUrlOrName.startsWith('https://');

  if (isCloudinaryUrl && isCloudinaryConfigured()) {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME!.trim();
      const apiKey = process.env.CLOUDINARY_API_KEY!.trim();
      const apiSecret = process.env.CLOUDINARY_API_SECRET!.trim();

      // Extract public_id from Cloudinary URL: .../image/upload/v12345/astro/students/filename.jpg
      const match = fileUrlOrName.match(/\/image\/upload\/(?:v\d+\/)?([^\.]+)/);
      const publicId = match ? match[1] : fileUrlOrName;

      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
      const signature = crypto
        .createHash('sha1')
        .update(paramsToSign + apiSecret)
        .digest('hex');

      const formData = new URLSearchParams();
      formData.append('public_id', publicId);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', apiKey);
      formData.append('signature', signature);

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.result === 'ok' || data.result === 'not found';
      }
      return false;
    } catch (error) {
      console.error('[Storage] Cloudinary delete failed:', error);
      return false;
    }
  }

  // 2. Local disk deletion path (Fallback & Legacy records)
  const filename = path.basename(fileUrlOrName);
  const categoryDir = path.join(STORAGE_BASE_DIR, category);
  const filePath = path.join(categoryDir, filename);

  // Security check: path traversal prevention
  if (!filePath.startsWith(categoryDir)) {
    return false;
  }

  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
  } catch (error) {
    console.error(`[Storage] Failed to delete file ${filePath}:`, error);
  }
  return false;
}

/**
 * Retrieves file path and metadata for authorized serving of local legacy files.
 */
export function getStoredImageMeta(
  category: string,
  filename: string
): { filePath: string; mimeType: string; size: number } | null {
  // Prevent path traversal
  const safeFilename = path.basename(filename);
  const safeCategory = path.basename(category);
  const categoryDir = path.join(STORAGE_BASE_DIR, safeCategory);
  const filePath = path.join(categoryDir, safeFilename);

  if (!filePath.startsWith(categoryDir) || !fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(safeFilename).toLowerCase();
  let mimeType = 'application/octet-stream';

  for (const [mime, extension] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (extension === ext) {
      mimeType = mime;
      break;
    }
  }

  return {
    filePath,
    mimeType,
    size: stat.size,
  };
}
