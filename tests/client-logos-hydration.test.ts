import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {durableStorage, databaseStorageEnabled} from '../src/services/durableStorage';

const KEY='atlas_clients_logos_v3_moshtari';

test('non-hydrated customer logo read is missing, without creating persistent data',()=>{
 assert.equal(databaseStorageEnabled(),false);
 assert.equal(durableStorage.getExistingItem(KEY),null);
 assert.equal(durableStorage.getItem(KEY),null);
 assert.throws(()=>durableStorage.setItem(KEY,'[]'),/پایگاه داده هنوز آماده نیست/);
 assert.equal(durableStorage.getExistingItem(KEY),null);
});

test('client logo getter never writes defaults during initial render',()=>{
 const source=readFileSync('src/services/clientService.ts','utf8');
 const getter=source.split('private getStorage(): ClientLogo[] {')[1]?.split('private saveStorage')[0];
 assert.ok(getter,'could not locate client getter');
 assert.match(getter,/getExistingItem\(STORAGE_KEY\)/);
 assert.doesNotMatch(getter,/saveStorage\(/);
 assert.match(getter,/Array\.isArray\(parsed\)/,'saved empty list stays empty');
});
