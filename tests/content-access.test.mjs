import test from 'node:test';
import assert from 'node:assert/strict';
import {serveMemberResource} from '../server/member-resources.mjs';

const resources={'/library-data.mjs':{type:'text/javascript',body:Buffer.from('PRIVATE_STORY').toString('base64')},'/assets/audio/test.mp3':{type:'audio/mpeg',body:Buffer.from([1,2,3]).toString('base64')}};
test('protected resources require server membership even with a query string',async()=>{
 const denied=async()=>{throw new Response('unauthorized',{status:401});};
 for(const path of ['/library-data.mjs','/library-data.mjs?v=old','/assets/audio/test.mp3']){
  const response=await serveMemberResource(new Request('https://example.test'+path),{},resources,denied);
  assert.equal(response.status,401);assert.doesNotMatch(await response.text(),/PRIVATE_STORY/);
  assert.match(response.headers.get('Cache-Control'),/no-store/);
 }
});
test('members receive only allowlisted resources, never traversal or framework source',async()=>{
 const allow=async()=>({id:'member'});
 const response=await serveMemberResource(new Request('https://example.test/library-data.mjs'),{},resources,allow);
 assert.equal(response.status,200);assert.equal(await response.text(),'PRIVATE_STORY');assert.match(response.headers.get('Cache-Control'),/private, no-store/);
 for(const path of ['/server/auth.mjs','/unknown','/%2e%2e/server/auth.mjs','/library-data.mjs/'])assert.equal((await serveMemberResource(new Request('https://example.test'+path),{},resources,allow)).status,404);
 const audio=await serveMemberResource(new Request('https://example.test/assets/audio/test.mp3'),{},resources,allow);
 assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())],[1,2,3]);
});
