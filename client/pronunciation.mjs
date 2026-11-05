/** Play the site's bundled pronunciation files without device speech voices. */
export function createPronunciationPlayer({
  resolveSource,
  createAudio = () => new Audio(),
  onState = () => {},
  onError = () => {},
  timeoutMs = 10000,
} = {}) {
  if (typeof resolveSource !== 'function') throw new TypeError('resolveSource is required');
  let generation = 0;
  let active = null;
  const delay = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000;

  const idle = () => onState({ status: 'idle', word: null, accent: null });
  function dispose() {
    if (!active) return;
    const session = active;
    active = null;
    session.cleanup?.();
    // Detach listeners before pause/load, which can themselves dispatch events.
    try { session.audio.pause(); } catch { /* Already unavailable. */ }
    try {
      session.audio.removeAttribute('src');
      session.audio.load();
    } catch { /* Cancellation must still invalidate this session. */ }
  }
  function stop() {
    generation += 1;
    dispose();
    idle();
  }

  function play(words, accent) {
    stop();
    if (!Array.isArray(words) || words.length === 0) return;
    const token = generation;
    let audio;
    try { audio = createAudio(); }
    catch {
      onError('当前浏览器无法播放音频，请用浏览器打开网页后重试。');
      return;
    }
    const session = { audio, queue: [...words], index: 0, track: 0, cleanup: null };
    active = session;
    audio.preload = 'auto';

    function next() {
      if (generation !== token || active !== session) return;
      session.cleanup?.();
      if (session.index >= session.queue.length) {
        stop();
        return;
      }
      const word = session.queue[session.index];
      const track = ++session.track;
      const current = () => generation === token && active === session && session.track === track;
      let timer;
      let status;
      const handlers = [];
      const clearTimer = () => { clearTimeout(timer); timer = undefined; };
      const listen = (event, handler) => {
        audio.addEventListener(event, handler);
        handlers.push([event, handler]);
      };
      session.cleanup = () => {
        clearTimer();
        for (const [event, handler] of handlers) audio.removeEventListener(event, handler);
      };
      function state(value) {
        if (!current() || status === value) return;
        status = value;
        onState({ status: value, word, accent });
      }
      function fail(message) {
        if (!current()) return;
        stop();
        onError(message);
      }
      function loading() {
        if (!current()) return;
        // Repeated stalled events must not postpone the failure indefinitely.
        if (timer === undefined) timer = setTimeout(() => fail('音频加载超时，请检查网络后重试。'), delay);
        state('loading');
      }
      function playing() {
        if (!current()) return;
        clearTimer();
        state('playing');
      }
      let source;
      try { source = resolveSource(word, accent); }
      catch { source = null; }
      if (typeof source !== 'string' || !source.trim()) {
        fail('这个单词的内置音频暂未提供，请试其他单词或另一种口音。');
        return;
      }
      listen('playing', playing);
      listen('waiting', loading);
      listen('stalled', loading);
      listen('error', () => {
        const code = audio.error?.code;
        fail(code === 2
          ? '音频下载失败，请检查网络后重试。'
          : '这段音频未能播放，请刷新页面后重试，或选择另一种口音。');
      });
      listen('ended', () => {
        if (!current()) return;
        session.index += 1;
        next();
      });
      try {
        audio.src = source;
        loading();
        if (!current()) return;
        // Keep this first call in the user's click stack for autoplay policies.
        const playback = audio.play();
        if (playback && typeof playback.then === 'function') {
          playback.then(playing, error => {
            if (!current()) return;
            fail(error?.name === 'NotAllowedError'
              ? '浏览器拦截了播放，请点击单词发音按钮后重试。'
              : error?.name === 'NotSupportedError'
                ? '浏览器无法解码这段音频，请刷新页面后重试，或选择另一种口音。'
                : '音频播放失败，请点击发音按钮重试。');
          });
        }
      } catch (error) {
        fail(error?.name === 'NotAllowedError'
          ? '浏览器拦截了播放，请点击单词发音按钮后重试。'
          : '音频播放失败，请点击发音按钮重试。');
      }
    }
    next();
  }
  return { play, stop };
}
