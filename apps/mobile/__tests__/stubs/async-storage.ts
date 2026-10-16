const data = new Map<string, string>()

const AsyncStorage = {
  data,
  getItem: async (k: string) => data.get(k) ?? null,
  setItem: async (k: string, v: string) => { data.set(k, v) },
  removeItem: async (k: string) => { data.delete(k) },
  clear: async () => { data.clear() },
}

export default AsyncStorage
