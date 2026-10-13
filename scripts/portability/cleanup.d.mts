export function portabilityErasureStatements(db: D1Database): Promise<D1PreparedStatement[]>;
export function portabilityRedactionCheckpoint(db: D1Database): Promise<{ sql: string; params: unknown[] }[]>;
