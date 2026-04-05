// Ultimate storage solution - completely avoids browser storage
class StorageManager {
  constructor() {
    this.memory = {};
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    // Never attempt to access browser storage
    console.log('StorageManager initialized with memory-only storage');
    this.initialized = true;
  }

  getItem(key) {
    this.init();
    return this.memory[key] || null;
  }

  setItem(key, value) {
    this.init();
    this.memory[key] = value;
  }

  removeItem(key) {
    this.init();
    delete this.memory[key];
  }

  clear() {
    this.init();
    this.memory = {};
  }

  // Debug method to show current storage
  debug() {
    console.log('Memory storage contents:', this.memory);
    return this.memory;
  }
}

// Create singleton instance
const storageManager = new StorageManager();

export default storageManager;
