// Only publish entries whose two audio files have passed decoding checks.
export const pronunciationSources = Object.fromEntries(
  ['proposal','signature','executive','subordinate','preliminary'].map(id => [id, {
    'en-GB': `./assets/audio/${id}-en-gb.mp3`,
    'en-US': `./assets/audio/${id}-en-us.mp3`,
  }])
);
