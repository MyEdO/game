// Types du serveur de l'export : mêmes signatures que servir.mjs.

export function servir(options: { web: string; modeles?: string }): Promise<{ url: string; fermer: () => void }>;
