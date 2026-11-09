import test from 'node:test';
import assert from 'node:assert/strict';
import {visionPublicOrigin} from '../src/utils/visionPublicOrigin';
test('public storefront does not return the retired VPS image origin',()=>{
 assert.equal(visionPublicOrigin('sanatpish.com','http://87.107.152.92','http://87.107.152.92'),'https://sanatpish.com');
 assert.equal(visionPublicOrigin('www.sanatpish.com','','http://localhost:3000'),'https://www.sanatpish.com');
});
test('preview and internal requests retain configured origin without credentials',()=>{
 assert.equal(visionPublicOrigin('localhost:3000','https://sanatpish.com/','http://localhost:3000'),'https://sanatpish.com');
 assert.equal(visionPublicOrigin('evil.sanatpish.com','','http://localhost:3000'),'http://localhost:3000');
});
