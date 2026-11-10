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

// Ensure category directories exist
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Validates and saves a Base64 data URI image into dedicated file storage.
 * Returns the public application URL path (/api/storage/<category>/<filename>).
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
 * Safely deletes a stored image file from disk.
 */
export async function deleteStoredImage(
  fileUrlOrName: string,
  category: 'students' | 'attendance' = 'students'
): Promise<boolean> {
  if (!fileUrlOrName) return false;

  // Extract pure filename
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
 * Retrieves file path and metadata for authorized serving.
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
