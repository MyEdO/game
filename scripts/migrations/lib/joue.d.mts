export const ANTIDATE: Date;
export const lireArbre: (rel: string) => string;
export const lireDans: (racine: string, rel: string) => string;
export function depot(fichiers: Record<string, string>, copies?: string[]): { racine: string; avant: Map<string, string> };
export const efface: (racine: string) => void;
export function rienTouche(racine: string, avant: Map<string, string>): string[];
export function crees(racine: string, avant: Map<string, string>, dossier: string): string[];
export function joue(racine: string, migration: string): { code: number | null; stdout: string; stderr: string; sortie: string };
export function refuse(migration: string, fichiers: Record<string, string>, message: string, copies?: string[]): void;
