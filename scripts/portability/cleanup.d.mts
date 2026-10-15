export function portabilityErasureStatements(db: D1Database): Promise<D1PreparedStatement[]>;
export function portabilityRedactionCheckpoint(db: D1Database): Promise<{ sql: string; params: unknown[] }[]>;

export function abortPortabilitySnapshot(db: D1Database, id: string): Promise<import('@runeditrun/rer/modules/portability').Status>;
export function portabilitySnapshotStatus(db: D1Database, id: string): Promise<import('@runeditrun/rer/modules/portability').Status>;
export function abortPortabilityActor(db: D1Database, actor: string): Promise<void>;
