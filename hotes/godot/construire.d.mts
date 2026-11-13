// Types de la construction de l'hôte Godot : mêmes signatures que construire.mjs.

export function empaqueter(sortie: string | null, mode: 'production' | 'development'): Promise<string>;

export function empaqueterLeProcessus(sortie: string): Promise<string>;
