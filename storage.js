// لایه‌ی ذخیره‌سازی یکپارچه.
// داخل محیط Claude (Artifacts) از window.storage استفاده می‌کند.
// در اجرای مستقل (بعد از کلون از گیت‌هاب و اجرا در مرورگر عادی) به‌طور خودکار
// روی localStorage سوییچ می‌کند تا برنامه بدون هیچ تغییری همان‌جا هم کار کند.

const hasClaudeStorage = typeof window !== "undefined" && !!window.storage;

export async function storageGet(key) {
  if (hasClaudeStorage) {
    try {
      const r = await window.storage.get(key, false);
      return r ? r.value : null;
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function storageSet(key, value) {
  if (hasClaudeStorage) {
    try {
      await window.storage.set(key, value, false);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ممکن است حجم localStorage پر شده باشد */
  }
}

export async function storageDelete(key) {
  if (hasClaudeStorage) {
    try {
      await window.storage.delete(key, false);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function storageList(prefix) {
  if (hasClaudeStorage) {
    try {
      const r = await window.storage.list(prefix, false);
      return r ? r.keys : [];
    } catch {
      return [];
    }
  }
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}
