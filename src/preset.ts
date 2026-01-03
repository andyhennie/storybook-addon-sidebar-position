import path from 'path';
import { fileURLToPath } from 'url';

function getManagerPath() {
  // ESM: use import.meta.url
  if (typeof import.meta.url !== 'undefined') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    return path.join(__dirname, 'manager.js');
  }
  // CJS: use __dirname
  return path.join(__dirname, 'manager.cjs');
}

function managerEntries(entry: string[] = []) {
  return [...entry, getManagerPath()];
}

export { managerEntries };
