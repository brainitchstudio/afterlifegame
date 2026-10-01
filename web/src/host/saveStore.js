// Port of Assets/Afterlife/Scripts/SaveStore.cs. Saves live in save.json beside server.py and are
// replaced atomically with the previous one kept as save.json.bak. When the Python server is not
// running (for example under `vite dev` alone), the same scheme falls back to localStorage.
const LOCAL_KEY = 'afterlife-v3';
const LOCAL_BACKUP = LOCAL_KEY + '.bak';
// Earlier React builds kept their autosave under this key; it is read once if nothing newer exists.
const PREVIOUS_WEB_KEY = 'afterlife.save.v1';

const local = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
};

async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Server responded ${response.status}`);
  return body;
}

export const SaveStore = {
  server: true,
  hasSave: false,
  pathname: 'save.json',

  // Reads the save and backup. Returns a warning message for the HUD, or '' when all is well.
  async load(simulation) {
    let save = null, backup = null;
    try {
      const body = await request('/api/save');
      // Older servers returned the save already parsed; the simulation restores from text.
      const text = value => (value == null || typeof value === 'string' ? value ?? null : JSON.stringify(value));
      save = text(body.save); backup = text(body.backup); this.pathname = body.path || this.pathname;
    } catch {
      this.server = false;
      this.pathname = 'browser storage (' + LOCAL_KEY + ')';
      save = local.get(LOCAL_KEY) ?? local.get(PREVIOUS_WEB_KEY);
      backup = local.get(LOCAL_BACKUP);
    }
    if (save == null) return '';
    this.hasSave = true;
    try {
      if (simulation.restore(save)) return '';
      if (backup != null && simulation.restore(backup)) return 'Recovered the previous autosave. The newest save failed validation.';
      // Preserve the rejected file before autosave can replace it.
      if (this.server) await request('/api/save/reject', { method: 'POST' }).catch(() => {});
      else local.set(LOCAL_KEY + '.rejected-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15), save);
      return 'Save could not be loaded; a copy was preserved. ' + simulation.restoreError(save);
    } catch (error) {
      return 'Unable to read save: ' + error.message;
    }
  },

  async write(json) {
    if (this.server) {
      try {
        await request('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json });
        this.hasSave = true;
        return;
      } catch (error) {
        if (error instanceof TypeError) this.server = false; // Server went away; keep playing on local storage.
        else throw error;
      }
    }
    const previous = local.get(LOCAL_KEY);
    if (previous != null) local.set(LOCAL_BACKUP, previous);
    if (!local.set(LOCAL_KEY, json)) throw new Error('Browser storage is full or unavailable.');
    this.hasSave = true;
  },

  // Last-chance save while the page is closing; fetch is not guaranteed to finish there.
  writeOnExit(json) {
    if (this.server && navigator.sendBeacon?.('/api/save', new Blob([json], { type: 'application/json' }))) return;
    const previous = local.get(LOCAL_KEY);
    if (previous != null) local.set(LOCAL_BACKUP, previous);
    local.set(LOCAL_KEY, json);
  },

  async openFolder() {
    if (!this.server) throw new Error('Saves are kept in browser storage while the Python server is not running.');
    await request('/api/open-save-folder', { method: 'POST' });
  },

  async quit() {
    if (this.server) await request('/api/shutdown', { method: 'POST' }).catch(() => {});
  },
};
