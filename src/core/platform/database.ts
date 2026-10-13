export interface DatabaseConnection {
  binding: D1Database
}

export function createDatabaseConnection(binding: D1Database): DatabaseConnection {
  return { binding }
}
