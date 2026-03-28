// Memory service — localStorage only, no server required
// Drop-in replacement for the D1-backed version.

export interface MemoryEntry {
  key: string;
  value: string;
}

export async function fetchMemory(): Promise<Record<string, string>> {
  try {
    const raw = localStorage.getItem('agent_memory');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function saveMemory(key: string, value: string): Promise<void> {
  try {
    const mem = await fetchMemory();
    mem[key] = value;
    localStorage.setItem('agent_memory', JSON.stringify(mem));
  } catch { /* non-critical */ }
}

export async function deleteMemory(key: string): Promise<void> {
  try {
    const mem = await fetchMemory();
    delete mem[key];
    localStorage.setItem('agent_memory', JSON.stringify(mem));
  } catch { /* non-critical */ }
}

export interface RagChunk { text: string; tokens: string[]; source: string; }

// RAG is persisted in IndexedDB by RAGStore (ai.ts) — these are no-ops.
export async function fetchRagChunks(): Promise<RagChunk[]> { return []; }
export async function saveRagChunks(_source: string, _chunks: Array<{ text: string; tokens: string[] }>): Promise<void> {}
export async function deleteRagSource(_source?: string): Promise<void> {}
