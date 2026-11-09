export type CustomerImageVaultRecord = {
  id: string;
  ownerId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: number;
  blob: Blob;
};

export type CustomerImageVaultMetadata = Omit<CustomerImageVaultRecord, 'blob'>;

const DB_NAME = 'sanatpish-customer-device-vault';
const DB_VERSION = 1;
const STORE_NAME = 'customer-images';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

let databasePromise: Promise<IDBDatabase> | null = null;

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'img-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('ذخیره‌سازی امن مرورگر در این دستگاه پشتیبانی نمی‌شود.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ownerId', 'ownerId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('بازکردن فضای محلی تصاویر ناموفق بود.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('فضای محلی تصاویر در برگه دیگری در حال به‌روزرسانی است.'));
    };
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('عملیات فضای محلی تصاویر ناموفق بود.'));
  });
}

async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) return '';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function requestCustomerVaultPersistence(): Promise<{ supported: boolean; persisted: boolean }> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist) return { supported: false, persisted: false };
  try {
    const already = storage.persisted ? await storage.persisted() : false;
    return { supported: true, persisted: already || await storage.persist() };
  } catch {
    return { supported: true, persisted: false };
  }
}

export async function saveCustomerDeviceImage(
  blob: Blob,
  ownerId: string,
  originalName = 'customer-image'
): Promise<CustomerImageVaultMetadata> {
  const mimeType = (blob.type || '').split(';')[0].toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) throw new Error('فقط تصاویر JPEG، PNG و WebP قابل ذخیره هستند.');
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.');

  await requestCustomerVaultPersistence();
  const record: CustomerImageVaultRecord = {
    id: makeId(),
    ownerId: ownerId || 'guest',
    originalName: String(originalName || 'customer-image').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180),
    mimeType,
    sizeBytes: blob.size,
    sha256: await sha256(blob),
    createdAt: Date.now(),
    blob,
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('ذخیره تصویر روی دستگاه کامل نشد.'));
    tx.onabort = () => reject(tx.error || new Error('ذخیره تصویر روی دستگاه لغو شد.'));
  });
  return {
    id: record.id,
    ownerId: record.ownerId,
    originalName: record.originalName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    sha256: record.sha256,
    createdAt: record.createdAt,
  };
}

export async function getCustomerDeviceImage(id: string): Promise<CustomerImageVaultRecord | null> {
  if (!id) return null;
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readonly');
  return (await requestResult(tx.objectStore(STORE_NAME).get(id))) || null;
}

export async function getCustomerDeviceImageMetadata(id: string): Promise<CustomerImageVaultMetadata | null> {
  const record = await getCustomerDeviceImage(id);
  if (!record) return null;
  return {
    id: record.id,
    ownerId: record.ownerId,
    originalName: record.originalName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    sha256: record.sha256,
    createdAt: record.createdAt,
  };
}

export async function listCustomerDeviceImages(ownerId: string, limit = 100): Promise<CustomerImageVaultMetadata[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const rows = await requestResult(tx.objectStore(STORE_NAME).index('ownerId').getAll(IDBKeyRange.only(ownerId)));
  return (rows as CustomerImageVaultRecord[])
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(1, Math.min(500, limit)))
    .map(record => ({
      id: record.id,
      ownerId: record.ownerId,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      createdAt: record.createdAt,
    }));
}

export async function adoptCustomerDeviceImage(id: string, ownerId: string): Promise<void> {
  const record = await getCustomerDeviceImage(id);
  if (!record) throw new Error('تصویر ذخیره‌شده روی دستگاه پیدا نشد.');
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ ...record, ownerId });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('اتصال تصویر به حساب مشتری انجام نشد.'));
    tx.onabort = () => reject(tx.error || new Error('اتصال تصویر به حساب مشتری لغو شد.'));
  });
}

export async function customerImageBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('خواندن تصویر برای پردازش هوش مصنوعی انجام نشد.'));
    reader.onerror = () => reject(new Error('خواندن تصویر برای پردازش هوش مصنوعی انجام نشد.'));
    reader.readAsDataURL(blob);
  });
}
