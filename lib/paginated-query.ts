type PageError = { message: string };
type Page<T> = { data: T[] | null; error: PageError | null };

// Keep each request below PostgREST's row limit, and fail rather than publish
// a plausible-looking partial total if any later page cannot be read.
export async function readAllPages<T>(
  readPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 500,
): Promise<Page<T>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid page size');
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await readPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}
