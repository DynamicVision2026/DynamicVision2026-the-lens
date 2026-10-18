import { type IDBPDatabase, openDB } from "idb";
import type { SavedPage } from "./model";

/** Everything lives in this device's IndexedDB. Nothing is sent to the server. */
const DB_NAME = "lens-snap";
const STORE = "pages";

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE, { keyPath: "id" });
    },
  });
  return dbp;
}

export async function savePage(page: SavedPage): Promise<void> {
  await (await db()).put(STORE, page);
}

export async function allPages(): Promise<SavedPage[]> {
  const pages = (await (await db()).getAll(STORE)) as SavedPage[];
  return pages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deletePage(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}

export async function setReviewed(pageId: string, index: number, reviewed: boolean): Promise<SavedPage | undefined> {
  const d = await db();
  const page = (await d.get(STORE, pageId)) as SavedPage | undefined;
  if (!page || !page.problems[index]) return undefined;
  page.problems[index].reviewed = reviewed;
  await d.put(STORE, page);
  return page;
}

/** For tests: forget the cached connection. */
export function _resetDbHandle() {
  dbp = null;
}
