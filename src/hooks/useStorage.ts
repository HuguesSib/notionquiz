// ==================== STORAGE HELPERS ====================
// Using localStorage for persistent storage

/**
 * Storage interface for type-safe storage operations
 */
interface Storage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  remove(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
}

const storage: Storage = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const result = localStorage.getItem(key);
      return result ? (JSON.parse(result) as T) : null;
    } catch { 
      return null; 
    }
  },
  
  async set<T = unknown>(key: string, value: T): Promise<boolean> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { 
      return false; 
    }
  },
  
  async list(prefix: string): Promise<string[]> {
    try {
      const keys: string[] = [];
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

  async remove(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  async clear(): Promise<boolean> {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }
};

export default storage;
