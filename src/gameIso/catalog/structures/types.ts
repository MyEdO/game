/** Apparence PARTAGÉE d'une structure d'arête (mur/porte), consommée par l'iso (walls.ts) ET le POV
 *  (geometry.ts). Donnée pure (`src/data/structureAppearance.json`), découplée de `StructureData` (règles).
 *  Couleurs : hex ou var CSS (`var(--struct-*)`, base.css). L'iso dérive l'ombrage par orientation via
 *  `shade()` à partir des couleurs de base ci-dessous ; le POV les teinte par la lumière. */
import type { DetailRecipe } from '../../detail/types';

export interface StructureAppearanceDef {
  id: string;
  type: 'structureAppearance';
  label: string;
  /** Hauteur visuelle métrique de la face du mur ; défaut `WALL_H_M`. */
  wallHeightM?: number;
  /** Recette de détail de surface (appareillage/joints/mouchetis) — consommée par les backends (iso + POV). */
  detail?: DetailRecipe;
  /** Face principale (POV + base de la face iso, ombrée par orientation). */
  face: string;
  /** Montant d'extrémité — chapiteau/socle dérivés par ombrage. */
  post: string;
  /** Panneau et moulure de travée sur un mur ordinaire. */
  bayPanel?: boolean;
  /** PIERRE : ferrure / arase+merlons / gravats / renfoncement de passage. */
  band?: string; cap?: string; rubble?: string; rubbleHi?: string; recess?: string;
  /** BOIS : couleurs de base des autres parties (la face vient de `face`). */
  wood?: { inset: string; frame: string; cap: string; skirt: string; rubble: string; rubbleHi: string };
  /** Fortification : parapet crénelé. */
  parapet?: {
    heightLevelFrac: number;
    merlonCount: number; merlonStep: number; merlonHeightPx: number;
    bands: number[]; bandThickPx: number; parapetBandFrac: number; arasePx: number;
  };
  /** Ouverture (porte bois ajourée / corps de garde béant `openingFrac ≥ 1`). `leaf`/`plank`/`handle` =
   *  couleurs du VANTAIL (porte FERMÉE : panneau + joints de planches + poignée). */
  door?: {
    openingFrac: number; lintelPx: number;
    jamb?: string; jambCap?: string;
    leaf?: string; plank?: string; handle?: string;
    herse?: { bars: number; topFrac: number; traverseFracs: number[]; traverseColor: string };
  };
  /** FENÊTRE (croisée sertie dans le mur) : `glass` = verre froid du JOUR, `lit` = verre AMBRÉ
   *  ÉMISSIF de la NUIT (halo chaud), `frame` = cadre/dormant, `mullion` = meneau + traverse (croisillon). */
  window?: { glass: string; lit: string; frame: string; mullion: string };
  /** RELIEF MINCE (m) des parties, consommé par le backend VOLUMIQUE qui en fait une BOÎTE centrée sur
   *  le plan médian du mur (`wallPartDepthM`). Deux quantités, une par FAMILLE de partie :
   *  `jut` = SAILLIE par CÔTÉ d'une partie posée devant de la matière pleine (épaisseur totale =
   *  épaisseur du mur + 2×`jut`) ; `thick` = épaisseur TOTALE d'une partie qui BOUCHE une ouverture
   *  (rien derrière elle ; 0 = plan unique au médian). Absent = les défauts par partie de
   *  `catalog/structures/index.ts`. */
  relief?: {
    jut?: Partial<Record<WallPart, number>>;
    thick?: Partial<Record<WallPart, number>>;
    /** Épaisseur (m) de la MATIÈRE PLEINE de cette apparence — défaut `WALL_MATTER_M`. */
    wallM?: number;
  };
}

/** Parties NOMMÉES d'un mur assemblé par le builder du pivot (`builders/walls`) — LISTE RUNTIME dont
 *  l'union `WallPart` dérive : le `switch` de `wallPartRelief` s'y mesure (garde d'exhaustivité), et le
 *  schéma de `structureAppearance.json` y contraint les clés de `relief`. Chaque backend résout la
 *  couleur de BASE d'une partie via `wallPartColor` puis applique SA lumière (orientation iso / tint POV). */
export const WALL_PARTS = [
  'face', 'poteau', 'couronnement', 'panneau', 'moulure', 'plinthe', // panneau bois encadré
  'chambranle', 'jambage', // encadrement d'une porte bois (l'ouverture elle-même est un TROU)
  'vantail', 'vantail-planche', 'poignee', // vantail de porte FERMÉE
  'vitre', 'meneau', // fenêtre AJOURÉE (vitre transparente + meneau/croisillon ; encadrée par la `face`)
  'parapet', 'bande', 'arase', 'merlon', // fortification crénelée
  'linteau', 'herse-barreau', 'herse-traverse', 'seuil', // corps de garde (herse / seuil d'éboulis)
  'gravats', 'gravats-tas', // brèche (structure abattue)
] as const;

export type WallPart = (typeof WALL_PARTS)[number];
