// Types de la construction de l'hôte Godot : mêmes signatures que construire.mjs.

export function empaqueter(sortie: string | null): Promise<{ code: string; modules: string[] }>;

export function empaqueterLeProcessus(sortie: string): Promise<{ chemin: string; modules: string[] }>;
