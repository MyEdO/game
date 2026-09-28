export interface EngineLeakFinding {
  line: number;
  name: string;
  detail: string;
}

/** Contexte d'un passage de scan : la table des résolveurs à RNG, tenue par l'appelant. */
export interface ContexteDeScanRng {
  resolveurs: Record<string, string[]> | null;
}
export function contexteDeScanRng(): ContexteDeScanRng;
export function scanBattleRngEngineLeak(relPath: string, contenu: string, ctx?: ContexteDeScanRng): EngineLeakFinding[];
