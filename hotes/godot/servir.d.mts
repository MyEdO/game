// Types du serveur de l'export : mêmes signatures que servir.mjs.

export function servir(options: { web: string; modeles?: string; depot?: string }): Promise<{ url: string; fermer: () => void }>;

export function listage(dossier: string): { manifestes: Record<string, unknown>; osDesRigides: Record<string, string[]>; erreurs: string[] };
