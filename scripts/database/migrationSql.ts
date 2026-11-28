/**
 * Normalize optional file-level transaction wrappers before the migration
 * runner applies all pending files inside its single PostgreSQL transaction.
 *
 * A migration may either be authored with an explicit outer BEGIN/COMMIT
 * pair or rely on the runner. Sending the former inside transaction() would
 * make PostgreSQL's inner COMMIT commit the runner's transaction early,
 * leaving the migration-history insert outside the intended atomic unit.
 *
 * Only standalone SQL transaction-control lines are removed. PL/pgSQL
 * BEGIN/END blocks (which do not use "BEGIN;") are left untouched.
 */
export function normalizeMigrationSql(sql: string): string {
  const lines = sql.split(/\r?\n/);
  const beginLines: number[] = [];
  const commitLines: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const command = lines[index].trim().toUpperCase();
    if (command === 'BEGIN;') beginLines.push(index);
    if (command === 'COMMIT;') commitLines.push(index);
  }

  if (beginLines.length > 1 || commitLines.length > 1) {
    throw new Error('Migration contains more than one file-level BEGIN/COMMIT pair.');
  }
  if (beginLines.length !== commitLines.length) {
    throw new Error('Migration contains an unmatched file-level BEGIN or COMMIT.');
  }
  if (beginLines.length === 1 && beginLines[0] > commitLines[0]) {
    throw new Error('Migration COMMIT appears before its file-level BEGIN.');
  }

  const transactionLines = new Set([...beginLines, ...commitLines]);
  const normalized = lines.filter((_, index) => !transactionLines.has(index)).join('\n').trim();
  if (!normalized) throw new Error('Migration contains no SQL after transaction normalization.');
  return normalized;
}
