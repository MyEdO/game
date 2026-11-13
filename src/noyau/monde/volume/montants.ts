/**
 * LES MONTANTS ET LA MATIÈRE PLEINE D'UN MUR (#3476) : épaisseurs MONDE (m) authorées en mètres, que la triangulation
 * reçoit par `FaceDepth` (`./worldTris`) — la croix d'un montant (poteau, jambage, pilier de surplomb) et la matière
 * pleine qu'il encadre.
 */
import type { StructureAppearanceDef } from '../../../data';
import type { EntreeVivante } from '../../../data/datasets';
import type { Face } from './types';

/** ÉPAISSEUR MONDE (m) de la MATIÈRE PLEINE d'un mur — AUTHORÉE EN MÈTRES, comme toute autre épaisseur
 *  du catalogue, et surchargeable par apparence (`StructureAppearanceDef.relief.wallM`). Elle valait
 *  jusqu'à C6 une largeur de TRAIT du peintre SVG d'authoring (3,8 px) ramenée au monde par l'échelle
 *  d'écran — un mur y était donc d'autant plus épais que la carte comptait de mètres par tuile. La
 *  valeur ci-dessous est l'équivalent de ce trait à 2 m/tuile, l'échelle de toutes les scènes de jeu :
 *  le geste déplace la SOURCE, pas le goût. */
export const WALL_MATTER_M = 0.168;

/** Épaisseur de la matière pleine pour une apparence donnée. */
export function wallMatterM(app?: EntreeVivante<StructureAppearanceDef>): number {
  return app?.relief?.wallM ?? WALL_MATTER_M;
}

/** LARGEURS MONDE (m) des MONTANTS — poteau et jambage d'un mur (`builders/walls`), pilier de surplomb
 *  d'un tablier (`builders/floors`). Mêmes provenance et conversion que `WALL_MATTER_M` (3,8 / 3,6 /
 *  5 px de trait à 2 m/tuile), authorées en mètres. */
export const UPRIGHT_WIDTH_M: Record<string, number> = { poteau: 0.168, jambage: 0.159, pilier: 0.221 };

/** SAILLIE (m) d'un montant hors des joues du mur qu'il encadre. Sans elle, la croix d'un montant a
 *  EXACTEMENT l'épaisseur de la boîte de mur et s'y inscrit à ras — mesuré sur `arene` : 340 montants
 *  sur 364 entièrement dans la matière, part noyée moyenne 99,2 %. */
export const UPRIGHT_OVERHANG_M = 0.044;

/** LARGEUR MONDE de la croix d'un montant : sa largeur propre, jamais moins que l'épaisseur du mur
 *  qu'il encadre, plus une saillie de chaque côté. */
export function uprightCrossM(part: string | undefined, wallM: number): number {
  const w = (part ? UPRIGHT_WIDTH_M[part] : undefined) ?? UPRIGHT_WIDTH_M.poteau;
  return Math.max(w, wallM) + 2 * UPRIGHT_OVERHANG_M;
}

/** Largeur de la croix d'une face MONTANT (2 points : poteau, jambage, pilier de surplomb), `undefined` pour toute autre
 *  face : le seul canal par lequel un montant reçoit sa dimension libre. `wallM` : la matière pleine du mur qu'il
 *  encadre. */
export function largeurDUnMontant(face: Face, wallM: number): number | undefined {
  return face.poly.length === 2 ? uprightCrossM(face.material.part, wallM) : undefined;
}
