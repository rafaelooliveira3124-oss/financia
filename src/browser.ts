// Preferências nunca devem impedir o acesso quando o navegador bloqueia storage.
export function readPreference(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* A preferência continua válida na memória da tela. */
  }
}
// Tokens continuam limitados à aba. Se sessionStorage falhar, ficam só na memória.
export function createSessionStorage() {
  const memory = new Map<string, string>();
  return {
    getItem(key: string) {
      try {
        return window.sessionStorage.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      try {
        window.sessionStorage.setItem(key, value);
      } catch {}
    },
    removeItem(key: string) {
      memory.delete(key);
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
    },
  };
}
export function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues)
    throw Error(
      "Seu navegador não disponibilizou a conexão segura necessária para criar o registro. Abra o site por HTTPS e atualize o navegador.",
    );
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
