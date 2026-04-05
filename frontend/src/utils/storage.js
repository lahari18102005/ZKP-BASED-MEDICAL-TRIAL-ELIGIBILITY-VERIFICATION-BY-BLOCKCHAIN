// In-memory storage fallback - completely avoids browser storage
let memoryStorage = {};

// Never attempt to access browser storage to prevent errors

const safeStorage = {
  getItem: (key) => {
    return memoryStorage[key] || null;
  },
  
  setItem: (key, value) => {
    memoryStorage[key] = value;
  },
  
  removeItem: (key) => {
    delete memoryStorage[key];
  },
  
  clear: () => {
    memoryStorage = {};
  }
};

export default safeStorage;
