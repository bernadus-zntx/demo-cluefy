export type LivePage<T> = {
  items: T[];
  pagination?: { nextCursor: string | null; snapshot: string };
};

export async function collectLivePages<T extends { id: string }, P extends LivePage<T>>(
  readPage: (cursor: string | null, snapshot: string | null) => Promise<P>,
): Promise<P> {
  const first = await readPage(null, null);
  const items = new Map(first.items.map(item => [item.id, item]));
  const cursors = new Set<string>();
  let page = first;
  while (page.pagination?.nextCursor) {
    const { nextCursor, snapshot } = page.pagination;
    if (cursors.has(nextCursor)) throw new Error('Halaman data live berulang. Silakan coba lagi.');
    cursors.add(nextCursor);
    page = await readPage(nextCursor, snapshot);
    for (const item of page.items) items.set(item.id, item);
  }
  return { ...first, items: [...items.values()] };
}

// The server splits UUIDs into four non-overlapping ranges under one snapshot.
// All partitions must complete before a new dataset can replace the previous one.
export async function collectPartitionedLivePages<T extends { id: string }, P extends LivePage<T>>(
  readPage: (cursor: string | null, snapshot: string | null, shard: string) => Promise<P>,
): Promise<P> {
  const first = await readPage(null, null, '0');
  if (!first.pagination) return first;
  const snapshot = first.pagination.snapshot;
  async function finish(shard: string, page: P) {
    const rows = [...page.items];
    const cursors = new Set<string>();
    while (page.pagination?.nextCursor) {
      const cursor = page.pagination.nextCursor;
      if (page.pagination.snapshot !== snapshot) throw new Error('Snapshot data live berubah. Silakan coba lagi.');
      if (cursors.has(cursor)) throw new Error('Halaman data live berulang. Silakan coba lagi.');
      cursors.add(cursor);
      page = await readPage(cursor, snapshot, shard);
      rows.push(...page.items);
    }
    if (page.pagination?.snapshot !== snapshot) throw new Error('Snapshot data live berubah. Silakan coba lagi.');
    return rows;
  }
  const groups = await Promise.all([
    finish('0', first),
    ...['1', '2', '3'].map(async shard => finish(shard, await readPage(null, snapshot, shard))),
  ]);
  return { ...first, items: [...new Map(groups.flat().map(item => [item.id, item])).values()] };
}
