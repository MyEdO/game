// Types du dossier des modèles et de son listage : mêmes signatures que listage.mjs.

export const DOSSIER_DES_MODELES: string;

export function listage(dossier: string): { manifestes: Record<string, unknown>; osDesRigides: Record<string, string[]>; erreurs: string[] };
