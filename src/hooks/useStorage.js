// ==================== STORAGE HELPERS ====================
// Using localStorage for persistent storage

const storage = {
  async get(key) {
    try {
      const result = localStorage.getItem(key);
      return result ? JSON.parse(result) : null;
    } catch { 
      return null; 
    }
  },
  
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { 
      return false; 
    }
  },
  
  async list(prefix) {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      return keys;
    } catch { 
      return []; 
    }
  },

  async remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  async clear() {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }
};

export default storage;
