import assert from 'node:assert/strict';
import test from 'node:test';
import {assertProductionDatabaseConfig} from '../../server/db/connection';

const valid:NodeJS.ProcessEnv={
 NODE_ENV:'production',
 DATA_BACKEND:'postgres',
 DATABASE_SCHEMA:'adopted',
 DATABASE_ENV:'production',
 DATABASE_URL:'postgresql://postgres:placeholder@db.example.test/postgres',
 DATABASE_SSL:'require',
};

test('production refuses to boot with local-file data backend',()=>{
 assert.throws(()=>assertProductionDatabaseConfig({...valid,DATA_BACKEND:'local'}),/DATA_BACKEND=postgres/);
});
test('production requires the adopted schema, production DB mode and encrypted PostgreSQL',()=>{
 for(const [key,value] of [['DATABASE_SCHEMA','prototype'],['DATABASE_ENV','development'],['DATABASE_SSL','disable']] as const){
  assert.throws(()=>assertProductionDatabaseConfig({...valid,[key]:value}));
 }
 assert.throws(()=>assertProductionDatabaseConfig({...valid,DATABASE_URL:''}),/DATABASE_URL/);
});
test('production accepts valid PostgreSQL environment, development is unaffected',()=>{
 assert.doesNotThrow(()=>assertProductionDatabaseConfig(valid));
 assert.doesNotThrow(()=>assertProductionDatabaseConfig({NODE_ENV:'development'}));
});
