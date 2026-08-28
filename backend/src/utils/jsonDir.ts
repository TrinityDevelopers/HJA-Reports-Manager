import fs from 'fs';
import path from 'path';

export type JsonDirEntry<T> = {
  file: string;
  name: string;
  value: T;
};

export type LoadJsonDirOptions = {
  sort?: boolean;
  stripExt?: boolean;
};

export function loadJsonDirSync<T = unknown>(
  dir: string,
  opts: LoadJsonDirOptions = {},
): JsonDirEntry<T>[] {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const ordered = opts.sort ? [...files].sort() : files;

  return ordered.map((file) => {
    const fullPath = path.join(dir, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const value = JSON.parse(raw) as T;
    const name = opts.stripExt === false ? file : file.replace(/\.json$/i, '');
    return { file, name, value };
  });
}
