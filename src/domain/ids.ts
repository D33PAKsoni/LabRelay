import { createHash } from 'node:crypto';
export const stableId = (...parts: (string | number)[]): string =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
