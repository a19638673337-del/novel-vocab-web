/** Learning records stay on this browser, isolated by the authenticated user ID. */
export const SESSION_CHANGED_KEY = 'cijian-account-session-changed';
const LEGACY_KEYS = ['cijian-library-v2', 'cijian-progress-v1'];

function checkedUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim() || userId !== userId.trim() || userId.length > 200) {
    throw new Error('需要有效的会员账号才能读取学习记录。');
  }
  return userId;
}

export function memberStorageKey(userId, logicalKey) {
  checkedUserId(userId);
  if (typeof logicalKey !== 'string' || !logicalKey) throw new Error('学习记录键不能为空。');
  return `cijian-member:${encodeURIComponent(userId)}:${encodeURIComponent(logicalKey)}`;
}

export function createMemberStorage(rawStorage, session) {
  const userId = checkedUserId(session?.user?.id);
  if (session.user.active !== true) throw new Error('当前账号尚未激活，无法读取学习记录。');
  const keyFor = logicalKey => memberStorageKey(userId, logicalKey);
  return Object.freeze({
    keyFor,
    getItem: logicalKey => rawStorage.getItem(keyFor(logicalKey)),
    setItem: (logicalKey, value) => rawStorage.setItem(keyFor(logicalKey), value),
    removeItem: logicalKey => rawStorage.removeItem(keyFor(logicalKey)),
    // Call only after an explicit request. Never select a legacy account automatically.
    readLegacy() {
      for (const key of LEGACY_KEYS) {
        const value = rawStorage.getItem(key);
        if (value !== null) return { key, value };
      }
      return null;
    },
  });
}
