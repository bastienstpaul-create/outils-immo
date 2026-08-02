// Sous-ensemble minimal de l'API des extensions Chrome utilisé par l'app (panneau latéral).
// Évite la dépendance @types/chrome. Au runtime web, `chrome.storage` est absent : tout
// accès est gardé par `isExtension` (voir ext.ts).

declare namespace chrome {
  namespace storage {
    interface StorageChange {
      newValue?: unknown
      oldValue?: unknown
    }
    interface StorageArea {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
      remove(keys: string | string[]): Promise<void>
    }
    const local: StorageArea
    const onChanged: {
      addListener(
        cb: (changes: Record<string, StorageChange>, areaName: string) => void,
      ): void
    }
  }
}
