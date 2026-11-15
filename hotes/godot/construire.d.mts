// Types de la construction de l'hôte Godot : mêmes signatures que construire.mjs.

export function empaqueter(sortie: string | null, mode: 'production' | 'development'): Promise<{ code: string; modules: string[] }>;

export function lecturesDuBundle(code: string): Record<string, number>;

export function empaqueterLeProcessus(sortie: string): Promise<{ chemin: string; modules: string[] }>;

export function piloter(options: {
  args: string[];
  env: Record<string, string>;
  rendu?: string;
  lance: (tuer: () => void) => void;
  encore: () => boolean;
}): Promise<{ lignes: string[]; erreurs: string[] }>;
