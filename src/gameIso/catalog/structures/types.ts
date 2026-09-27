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
  /** Ouverture d'une porte de mur ordinaire (sans `parapet`). `leaf`/`plank`/`handle` = couleurs du
   *  VANTAIL (porte FERMÉE : panneau + joints de planches + poignée). */
  door?: {
    openingFrac: number;
    jamb?: string; jambCap?: string;
    leaf?: string; plank?: string; handle?: string;
  };
  /** CLAIRE-VOIE (herse, garde-corps) : `bars` intervalles de barreaux sur l'arête, dressés de
   *  `bottomFrac` à `topFrac` de `wallHeightM`, et des traverses aux fractions `traverseFracs` de cette
   *  hauteur ajourée. Elle BOUCHE une ouverture fermée, ou remplace la face pleine d'un mur — encadrée
   *  alors de sa `plinthe` et de sa `mainCourante` quand l'apparence les porte. */
  claireVoie?: {
    bars: number; bottomFrac: number; topFrac: number; traverseFracs: number[]; traverseColor: string;
    plinthe: boolean; mainCourante: boolean;
  };
  /** CORPS DE GARDE : la baie d'un mur à `parapet` — passage béant sous un linteau de `lintelPx`, barré
   *  de la claire-voie de l'apparence quand il est fermé. */
  corpsDeGarde?: { lintelPx: number };
  /** FENÊTRE (croisée décorative sertie dans le mur) : `glass` = verre froid du JOUR, `lit` = verre AMBRÉ
   *  ÉMISSIF de la NUIT (halo chaud), `mullion` = meneau + traverse (croisillon). */
  window?: { glass: string; lit: string; mullion: string };
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
  'linteau', 'seuil', // corps de garde (linteau / seuil d'éboulis)
  'barreau', 'traverse', // claire-voie (herse, garde-corps)
  'gravats', 'gravats-tas', // brèche (structure abattue)
] as const;

export type WallPart = (typeof WALL_PARTS)[number];
