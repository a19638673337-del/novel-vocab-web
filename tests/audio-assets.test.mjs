import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { words } from '../client/story-data.mjs';
import { pronunciationSources } from '../client/pronunciations.mjs';

test('every displayed word has both same-origin pronunciation files', () => {
  for (const word of words) {
    for (const accent of ['en-GB','en-US']) {
      const source=pronunciationSources[word.id]?.[accent];
      assert.match(source, /^\.\/assets\/audio\/[a-z]+-en-(gb|us)\.mp3$/);
      const data=fs.readFileSync(new URL(`../client/${source}`, import.meta.url));
      assert.ok(data.length>1000, `${word.id} ${accent} is empty`);
      assert.ok(data.subarray(0,3).toString()==='ID3'||(data[0]===255&&(data[1]&224)===224), 'MP3 header');
    }
  }
});
