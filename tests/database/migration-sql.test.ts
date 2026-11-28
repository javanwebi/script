import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMigrationSql } from '../../scripts/database/migrationSql';

test('removes a file-level BEGIN/COMMIT pair so the runner owns the transaction', () => {
  const source = `-- additive migration
BEGIN;
CREATE TABLE public.example(id integer);
COMMIT;
`;

  assert.equal(
    normalizeMigrationSql(source),
    '-- additive migration\nCREATE TABLE public.example(id integer);'
  );
});

test('preserves PL/pgSQL BEGIN/END blocks inside DO statements', () => {
  const source = `DO $$
BEGIN
  PERFORM 1;
END
$$;`;

  assert.equal(normalizeMigrationSql(source), source);
});

test('accepts migrations without explicit transaction wrappers', () => {
  assert.equal(normalizeMigrationSql('\nSELECT 1;\n'), 'SELECT 1;');
});

test('rejects an unmatched file-level transaction command', () => {
  assert.throws(
    () => normalizeMigrationSql('BEGIN;\nCREATE TABLE public.example(id integer);'),
    /unmatched file-level BEGIN or COMMIT/
  );
});

test('rejects multiple file-level transaction wrappers', () => {
  assert.throws(
    () => normalizeMigrationSql('BEGIN;\nSELECT 1;\nCOMMIT;\nBEGIN;\nSELECT 2;\nCOMMIT;'),
    /more than one file-level BEGIN\/COMMIT pair/
  );
});
