import { createHash } from 'node:crypto';
export function sha256(str: string) { return createHash('sha256').update(str,'utf8').digest('hex'); }
