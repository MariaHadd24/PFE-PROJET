export type StoredOrderFile = {
  key: string;
  blob: Blob;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

const DB_NAME = 'leoni-orders-db';
const DB_VERSION = 1;
const STORE = 'orderFiles';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction error'));
  });
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function putOrderFile(params: {
  key: string;
  file: File;
  uploadedAt?: string;
}): Promise<StoredOrderFile> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  const record: StoredOrderFile = {
    key: params.key,
    blob: params.file,
    name: params.file.name,
    size: params.file.size,
    type: params.file.type || 'application/octet-stream',
    uploadedAt: params.uploadedAt ?? new Date().toISOString(),
  };

  store.put(record);
  await txDone(tx);
  return record;
}

export async function putOrderFileFromBlob(params: {
  key: string;
  blob: Blob;
  name: string;
  uploadedAt: string;
}): Promise<StoredOrderFile> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  const record: StoredOrderFile = {
    key: params.key,
    blob: params.blob,
    name: params.name,
    size: params.blob.size,
    type: params.blob.type || 'application/octet-stream',
    uploadedAt: params.uploadedAt,
  };

  store.put(record);
  await txDone(tx);
  return record;
}

export async function getOrderFile(key: string): Promise<StoredOrderFile | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const res = await reqResult<StoredOrderFile | undefined>(store.get(key));
  await txDone(tx);
  return res;
}

export async function deleteOrderFile(key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  store.delete(key);
  await txDone(tx);
}
