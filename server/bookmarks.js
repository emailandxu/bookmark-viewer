import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_BOOKMARK_PATH = join(
  homedir(),
  '.config',
  'google-chrome',
  'Default',
  'Bookmarks',
);

const CHROME_EPOCH_MS = Date.UTC(1601, 0, 1);

function chromeTimestampToDate(value) {
  if (!value || value === '0') {
    return null;
  }
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return null;
  }
  const milliseconds = Math.floor(asNumber / 1000);
  const timestamp = CHROME_EPOCH_MS + milliseconds;
  return new Date(timestamp);
}

function findFolderByName(node, targetName) {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFolderByName(child, targetName);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (node.type === 'folder' && node.name === targetName) {
    return node;
  }

  if (node.children) {
    return findFolderByName(node.children, targetName);
  }

  for (const value of Object.values(node)) {
    if (value && (Array.isArray(value) || typeof value === 'object')) {
      const found = findFolderByName(value, targetName);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function collectUrlEntries(nodes, parentChain = [], bucket = []) {
  if (!nodes) {
    return bucket;
  }

  if (!Array.isArray(nodes)) {
    return collectUrlEntries([nodes], parentChain, bucket);
  }

  for (const entry of nodes) {
    if (!entry) continue;

    if (entry.type === 'url') {
      bucket.push({
        entry,
        parents: parentChain,
      });
      continue;
    }

    if (entry.type === 'folder' && Array.isArray(entry.children)) {
      const nextParents = entry.name ? [...parentChain, entry.name] : parentChain;
      collectUrlEntries(entry.children, nextParents, bucket);
    }
  }

  return bucket;
}

export async function loadWatchedBookmarks(options = {}) {
  const bookmarksPath = options.bookmarksPath || process.env.BOOKMARKS_PATH || DEFAULT_BOOKMARK_PATH;
  const rawContent = await readFile(bookmarksPath, 'utf-8');
  const data = JSON.parse(rawContent);
  const watchedFolder = findFolderByName(data, '看过');

  const response = {
    folderName: '看过',
    sourcePath: bookmarksPath,
    found: Boolean(watchedFolder),
    updatedAt: new Date().toISOString(),
    groups: [],
    totalCount: 0,
  };

  if (!watchedFolder) {
    return response;
  }

  const urlEntries = collectUrlEntries(watchedFolder.children, []);

  const items = urlEntries.map(({ entry, parents }) => {
    const dateAdded = chromeTimestampToDate(entry.date_added);
    const dateLastUsed = chromeTimestampToDate(entry.date_last_used);

    return {
      id: entry.id,
      title: entry.name || entry.url,
      url: entry.url,
      path: parents,
      dateAdded: dateAdded ? dateAdded.toISOString() : null,
      dateLastUsed: dateLastUsed ? dateLastUsed.toISOString() : null,
      rawDateAdded: entry.date_added,
      rawDateLastUsed: entry.date_last_used,
      guid: entry.guid,
    };
  });

  items.sort((a, b) => {
    if (a.dateAdded && b.dateAdded) {
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    }
    if (a.dateAdded) return -1;
    if (b.dateAdded) return 1;
    return 0;
  });

  const grouped = new Map();
  for (const item of items) {
    const key = item.dateAdded ? item.dateAdded.slice(0, 10) : 'unknown';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  }

  const groupEntries = Array.from(grouped.entries()).map(([date, entries]) => {
    const sortTimestamp = entries[0]?.dateAdded
      ? new Date(entries[0].dateAdded).getTime()
      : 0;
    return {
      date,
      sortTimestamp,
      items: entries,
    };
  });

  groupEntries.sort((a, b) => b.sortTimestamp - a.sortTimestamp);

  response.groups = groupEntries.map(({ date, items: dateItems }) => ({
    date,
    items: dateItems,
    count: dateItems.length,
  }));
  response.totalCount = items.length;

  return response;
}
