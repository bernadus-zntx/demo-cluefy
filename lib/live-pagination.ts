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
