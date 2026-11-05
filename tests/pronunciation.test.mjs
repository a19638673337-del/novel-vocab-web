import test from 'node:test';
import assert from 'node:assert/strict';
import { createPronunciationPlayer } from '../client/pronunciation.mjs';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
class FakeAudio {
  constructor() {
    this.listeners = new Map();
    this.calls = [];
    this.pending = [];
  }
  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
  }
  removeEventListener(event, fn) { this.listeners.get(event)?.delete(fn); }
  emit(event) { for (const fn of [...(this.listeners.get(event) || [])]) fn(); }
  play() {
    this.calls.push(this.src);
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }
  pause() { this.paused = true; }
  removeAttribute(key) { if (key === 'src') this.src = ''; }
  load() { this.loaded = true; }
}
function setup(options = {}) {
  const audios = [];
  const states = [];
  const errors = [];
  const player = createPronunciationPlayer({
    resolveSource: (word, accent) => `./audio/${accent}/${word}.mp3`,
    createAudio: () => { const audio = new FakeAudio(); audios.push(audio); return audio; },
    onState: state => states.push(state),
    onError: error => errors.push(error),
    ...options,
  });
  return { player, audios, states, errors };
}

test('first play is synchronous; a queue reuses one Audio and finishes idle', async () => {
  const { player, audios, states, errors } = setup();
  player.play(['proposal', 'signature'], 'uk');
  const audio = audios[0];
  assert.deepEqual(audio.calls, ['./audio/uk/proposal.mp3']);
  assert.equal(states.at(-1).status, 'loading');
  audio.pending[0].resolve();
  await tick();
  assert.equal(states.at(-1).status, 'playing');
  audio.emit('ended');
  assert.equal(audios.length, 1);
  assert.deepEqual(audio.calls, ['./audio/uk/proposal.mp3', './audio/uk/signature.mp3']);
  audio.emit('playing');
  assert.equal(states.at(-1).word, 'signature');
  audio.emit('ended');
  assert.equal(states.at(-1).status, 'idle');
  assert.deepEqual(errors, []);
  assert.equal(audio.paused, true);
});

test('stop ignores late promise resolution, rejection and old handlers', async () => {
  const { player, audios, states, errors } = setup();
  player.play(['a', 'b'], 'uk');
  const old = audios[0];
  const oldEnded = [...old.listeners.get('ended')][0];
  player.stop();
  const length = states.length;
  old.pending[0].resolve();
  oldEnded();
  old.emit('error');
  await tick();
  assert.equal(states.length, length);
  assert.equal(old.calls.length, 1);
  assert.deepEqual(errors, []);
  player.play(['c'], 'us');
  player.stop();
  audios[1].pending[0].reject(new Error('late failure'));
  await tick();
  assert.deepEqual(errors, []);
});

test('switching accents isolates old events and pending promises', async () => {
  const { player, audios, states, errors } = setup();
  player.play(['a', 'b'], 'uk');
  const old = audios[0];
  const oldPlaying = [...old.listeners.get('playing')][0];
  player.play(['c'], 'us');
  old.pending[0].reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  oldPlaying();
  old.emit('ended');
  await tick();
  assert.equal(states.at(-1).accent, 'us');
  assert.equal(states.at(-1).status, 'loading');
  assert.deepEqual(errors, []);
  player.stop();
});

test('previous track promise cannot mark the following track as playing', async () => {
  const { player, audios, states } = setup();
  player.play(['a', 'b'], 'uk');
  audios[0].emit('ended');
  audios[0].pending[0].resolve();
  await tick();
  assert.equal(states.at(-1).word, 'b');
  assert.equal(states.at(-1).status, 'loading');
  player.stop();
});

test('autoplay rejection reports a real error and returns idle', async () => {
  const { player, audios, states, errors } = setup();
  player.play(['a'], 'uk');
  audios[0].pending[0].reject(Object.assign(new Error(), { name: 'NotAllowedError' }));
  await tick();
  assert.equal(states.at(-1).status, 'idle');
  assert.match(errors[0], /浏览器拦截/);
  assert.equal(states.some(state => state.status === 'playing'), false);
});

test('missing files fail without attempting a request', () => {
  const { player, audios, errors, states } = setup({ resolveSource: () => null });
  player.play(['a'], 'uk');
  assert.equal(audios[0].calls.length, 0);
  assert.match(errors[0], /暂未提供/);
  assert.equal(states.at(-1).status, 'idle');
});

test('empty queue cancels playback without creating another audio', () => {
  const { player, audios, states } = setup();
  player.play(['a'], 'uk');
  player.play([], 'uk');
  assert.equal(audios.length, 1);
  assert.equal(audios[0].paused, true);
  assert.equal(states.at(-1).status, 'idle');
});

test('network errors stop the queue and identify the failure', () => {
  const { player, audios, states, errors } = setup();
  player.play(['a', 'b'], 'uk');
  audios[0].error = { code: 2 };
  audios[0].emit('error');
  assert.match(errors[0], /下载失败/);
  assert.equal(states.at(-1).status, 'idle');
  assert.equal(audios[0].calls.length, 1);
});

test('load timeout cancels the request and ignores subsequent success', async () => {
  const { player, audios, states, errors } = setup({ timeoutMs: 15 });
  player.play(['a'], 'uk');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.match(errors[0], /超时/);
  audios[0].pending[0].resolve();
  await tick();
  assert.equal(states.at(-1).status, 'idle');
  assert.equal(errors.length, 1);
});

test('stalled playback is bounded; resumed playback clears its timeout', async () => {
  const { player, audios, states, errors } = setup({ timeoutMs: 15 });
  player.play(['a'], 'uk');
  const audio = audios[0];
  audio.emit('playing');
  audio.emit('stalled');
  assert.equal(states.at(-1).status, 'loading');
  audio.emit('playing');
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.deepEqual(errors, []);
  audio.emit('stalled');
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.match(errors[0], /超时/);
  assert.equal(states.at(-1).status, 'idle');
});

test('synchronous play failures and unavailable Audio are handled', () => {
  const one = setup({ createAudio: () => { throw new Error('unsupported'); } });
  one.player.play(['a'], 'uk');
  assert.match(one.errors[0], /无法播放/);
  const audio = new FakeAudio();
  audio.play = () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); };
  const two = setup({ createAudio: () => audio });
  two.player.play(['a'], 'uk');
  assert.match(two.errors[0], /浏览器拦截/);
  assert.equal(two.states.at(-1).status, 'idle');
});
