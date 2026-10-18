import { MemoryStorage } from '@nukkad/mcp-server';

let sharedStorage: MemoryStorage | null = null;

export function getSharedStorage(): MemoryStorage {
  if (!sharedStorage) {
    sharedStorage = new MemoryStorage();
  }
  return sharedStorage;
}
