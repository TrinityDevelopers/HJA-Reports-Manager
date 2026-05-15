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

export async function loadJsonDir<T = unknown>(
  dir: string,
  opts: LoadJsonDirOptions = {},
): Promise<JsonDirEntry<T>[]> {
  const files = (await fs.promises.readdir(dir)).filter((f) => f.endsWith('.json'));
  const ordered = opts.sort ? [...files].sort() : files;

  return await Promise.all(
    ordered.map(async (file) => {
      const fullPath = path.join(dir, file);
      const raw = await fs.promises.readFile(fullPath, 'utf-8');
      const value = JSON.parse(raw) as T;
      const name = opts.stripExt === false ? file : file.replace(/\.json$/i, '');
      return { file, name, value };
    }),
  );
}

export function indexBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T> {
  return items.reduce(
    (acc, item) => {
      acc[keyFn(item)] = item;
      return acc;
    },
    {} as Record<string, T>,
  );
}

export function assertUniqueKeys(keys: string[], label: string): void {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) dupes.add(k);
    seen.add(k);
  }
  if (dupes.size > 0) {
    throw new Error(`Duplicate ${label} keys: ${Array.from(dupes).join(', ')}`);
  }
}
