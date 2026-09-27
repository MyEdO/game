export interface EngineLeakFinding {
  line: number;
  name: string;
  detail: string;
}

export function scanBattleRngEngineLeak(relPath: string, contenu: string): EngineLeakFinding[];
