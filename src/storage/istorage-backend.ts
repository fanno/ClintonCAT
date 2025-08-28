export interface IStorageBackend {
    set(key: string, value: unknown): Promise<void>;
    get(key: string): Promise<unknown>;
    remove?(key: string): Promise<void>;
}

/*
export interface IStorageSyncBackend {
    buffer: Map<string, unknown>;
    removals: string[];
    flushTimeout: NodeJS.Timeout | null;

    set(key: string, value: unknown): Promise<void>;
    get(key: string): Promise<unknown>;
    remove?(key: string): Promise<void>;
    scheduleSync(delay: number): void;
}
*/
