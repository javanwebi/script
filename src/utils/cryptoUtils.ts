/**
 * Browser-safe and Node-safe synchronous string hashing and UUID generation.
 * Avoids top-level imports of node:crypto which fail in browser Vite bundles.
 */

export function hashStringSync(input: string | Uint8Array): string {
  const str = typeof input === 'string' ? input : new TextDecoder().decode(input);
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9, h3 = 0x04c11db7, h4 = 0x1ed8b5a5;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ ch, 2246822519);
    h3 = Math.imul(h3 ^ ch, 3266489917);
    h4 = Math.imul(h4 ^ ch, 668265263);
  }
  return [h1, h2, h3, h4].map(h => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

export function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
