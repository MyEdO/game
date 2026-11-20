// Types du dossier des modèles et de son listage : mêmes signatures que listage.mjs.

export const DOSSIER_DES_MODELES: string;

export function listage(dossier: string): Promise<{ manifestes: Record<string, unknown>; osDesRigides: Record<string, string[]>; zonesPortantes: Record<string, Record<string, string[]>>; erreurs: string[]; forme: 'glb' }>;

export const LISTAGE: string;

export function deposerLesModeles<T>(dossier: string, sortie: string, fabriquer: (modeles: { id: string; glb: string; scene: string }[]) => T): Promise<Awaited<T>>;
