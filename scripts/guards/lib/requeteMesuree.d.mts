export type RequeteMesuree = { args: string[]; cwd: string; canal?: 'stdout'; status: number | null; stdout: string; stderr: string };
export function porteUnControle(texte: string): boolean;
export const MARQUE_RACINE_MESUREE: '<RACINE>';
export function verifierRequeteMesuree(requete: RequeteMesuree): true;
export function normaliserRequeteMesuree(racine: string, requete: RequeteMesuree): RequeteMesuree;
