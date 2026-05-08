export type SeedResult = {
  created: number;
  updated: number;
};

type SeedOptions<TDef, TExisting> = {
  defs: Array<{ key: string; def: TDef }>;
  findExisting: (key: string, def: TDef) => Promise<TExisting | null>;
  updateExisting: (existing: TExisting, key: string, def: TDef) => Promise<void>;
  createNew: (key: string, def: TDef) => Promise<void>;
  logLabel?: (key: string, def: TDef) => string;
};

export async function seedFromDefinitions<TDef, TExisting>({
  defs,
  findExisting,
  updateExisting,
  createNew,
  logLabel,
}: SeedOptions<TDef, TExisting>): Promise<SeedResult> {
  let created = 0;
  let updated = 0;

  for (const { key, def } of defs) {
    const existing = await findExisting(key, def);
    const label = logLabel?.(key, def) ?? key;

    if (existing) {
      await updateExisting(existing, key, def);
      updated += 1;
      console.log(`✓ Updated: ${label}`);
    } else {
      await createNew(key, def);
      created += 1;
      console.log(`✓ Created: ${label}`);
    }
  }

  return { created, updated };
}
