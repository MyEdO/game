import { parterreSeatCells, puitsRim } from './floorplan';
import type { SceneEntity } from '../../state/scene';

/**
 * Meublage FIDÈLE du Théâtre Staatsoper d'après le plan officiel (NADJ 08 folio 38 rez / folio 39 étage, images) — la
 * géométrie vit dans `opera/floorplan.ts`, ce module ne porte que le MOBILIER posé pièce par pièce.
 * Consommateurs du jour : le scénario de recette `test-scenarios/opera-plan.ts` (rendu EN JEU de ce
 * meublage), `scripts/qc/opera-furniture-check.mts` (placement contre la géométrie) et les deux gardes
 * de population (`src/gameIso/catalog/props-volumiques.test.ts`, `src/data/prop-foot-migration.test.ts`).
 * La LOGIQUE de la soirée vit, elle, dans le scénario jouable « Opéra » (`test-scenarios/opera`), qui a
 * sa propre carte et ses propres entités.
 *
 * Repère (cf. floorplan.ts) : y croissant = du FOND (scène, y bas) vers le FOYER (façade, y haut) ;
 * axe x=21.5. Le public regarde la scène, vers le HAUT. `facing:'N'` = tourné vers la scène (y bas) ;
 * sur l'étage les sièges regardent le PUITS (centre). Les props 1×1 PIVOTENT avec la caméra (`project`).
 */

/** Rangée de sièges 1×1 sur l'axe x de [x0..x1] à la rangée y, regardant `dir` (défaut Nord = scène). */
const seatRow = (id: string, y: number, x0: number, x1: number, dir: SceneEntity['facing'] = 'N', z = 0): SceneEntity[] => {
  const out: SceneEntity[] = [];
  for (let x = x0; x <= x1; x++) out.push({ id: `${id}-${x}`, kind: 'prop', ref: 'siege', pos: { x, y }, facing: dir, ...(z ? { z } : {}) });
  return out;
};
/** Colonne de sièges 1×1 sur l'axe y de [y0..y1] à la colonne x, regardant `dir`. */
const seatCol = (id: string, x: number, y0: number, y1: number, dir: SceneEntity['facing'], z = 0): SceneEntity[] => {
  const out: SceneEntity[] = [];
  for (let y = y0; y <= y1; y++) out.push({ id: `${id}-${y}`, kind: 'prop', ref: 'siege', pos: { x, y }, facing: dir, ...(z ? { z } : {}) });
  return out;
};

const ents: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 21, y: 54 } }, // entrée par le foyer (marbre, bas)

  // ═══════════════ SCÈNE (19, z=0, rangées 5-14, cols 13-30, planches surélevées) ═══════════════
  // Rideau de scène en travers du fond (côté coulisses, regarde le public au sud), sur toute la largeur.
  ...[13, 16, 19, 22, 25, 28].map((x, i): SceneEntity => ({ id: `rideau-${i}`, kind: 'prop', ref: 'rideau-scene', pos: { x, y: 5 }, facing: 'S' })),
  // Décors en place sur la scène (châssis peints + un praticable) — le plan montre des panneaux au sol.
  { id: 'scene-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 15, y: 10 } },
  { id: 'scene-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 28, y: 10 } },
  { id: 'scene-colonne', kind: 'prop', ref: 'colonne-brisee', pos: { x: 21, y: 9 } },

  // ═══════════════ COULISSES (16, z=0, rangées 1-4 derrière la scène) ═══════════════
  // Décors en attente, accessoires : châssis, mannequins de costumier, caisses, râtelier d'accessoires.
  { id: 'cl-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 13, y: 2 } },
  { id: 'cl-mann-1', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 16, y: 2 } },
  { id: 'cl-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 19, y: 3 } },
  { id: 'cl-rack', kind: 'prop', ref: 'rack-armes', pos: { x: 24, y: 2 } },
  { id: 'cl-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 27, y: 3 } },
  { id: 'cl-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 30, y: 2 } },

  // ═══════════════ FOSSE D'ORCHESTRE (18, z=0, rangées 15-19, gx 16-26, planches en contrebas) ═══════════
  // Pupitres des musiciens disposés en arc face à la scène (le plan montre une rangée de pupitres + tabourets).
  ...[17, 19, 21, 23, 25].map((x, i): SceneEntity => ({ id: `pup-${i}`, kind: 'prop', ref: 'pupitre-chef', pos: { x, y: 16 }, facing: 'N' })),
  { id: 'pup-chef', kind: 'prop', ref: 'pupitre-chef', pos: { x: 21, y: 18 }, facing: 'N' },
  { id: 'orch-tab-1', kind: 'prop', ref: 'tabouret', pos: { x: 18, y: 18 } },
  { id: 'orch-tab-2', kind: 'prop', ref: 'tabouret', pos: { x: 24, y: 18 } },

  // ═══════════════ PARTERRE / ORCHESTRE (17, z=0, rangées 17-44, éventail) ═══════════════
  // Fauteuils 1×1 remplissant TOUT l'éventail, de bord à bord (DENSE comme le plan p.40 : ≈14 rangées
  // pleines), un rang sur deux (circulation entre les rangs), fine allée centrale de 2 cases. Toute la
  // géométrie vient de `parterreSeatCells` (floorplan = source unique) ; ils regardent la scène (Nord).
  ...parterreSeatCells().map((c, i): SceneEntity => ({ id: `pt-${i}`, kind: 'prop', ref: 'siege', pos: c, facing: 'N' })),

  // ═══════════════ FOYER (7 Salon, z=0, marbre rangées 46-52) ═══════════════
  // Grand hall d'accueil sobre : statues d'honneur encadrant l'entrée du parterre, urnes, plantes, appliques.
  // Statues HORS des cages 8/9 et de leurs colonnes de rampe (`RAMP_X`), symétriques sur l'axe 21,5 : le
  // folio 38 n'en montre aucune au foyer 7, leur position est app-owned.
  { id: 'foy-statue-g', kind: 'prop', ref: 'statue', pos: { x: 11, y: 47 } },
  { id: 'foy-statue-d', kind: 'prop', ref: 'statue', pos: { x: 32, y: 47 } },
  { id: 'foy-urne-g', kind: 'prop', ref: 'urne', pos: { x: 14, y: 47 } },
  { id: 'foy-urne-d', kind: 'prop', ref: 'urne', pos: { x: 29, y: 47 } },
  { id: 'foy-plante-1', kind: 'prop', ref: 'plante-pot', pos: { x: 11, y: 50 } },
  { id: 'foy-plante-2', kind: 'prop', ref: 'plante-pot', pos: { x: 32, y: 50 } },
  { id: 'foy-banc-g', kind: 'prop', ref: 'banc', pos: { x: 18, y: 51 } },
  { id: 'foy-banc-d', kind: 'prop', ref: 'banc', pos: { x: 25, y: 51 } },
  { id: 'foy-app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 48 } },
  { id: 'foy-app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 48 } },

  // 6 VESTIAIRE ET VENTE DES BILLETS (coins de la façade) : comptoir de billetterie. Face au NORD :
  // le public le borde depuis le foyer, le guichetier tient le vestiaire derrière lui (rangée 57).
  { id: 'billet-g', kind: 'prop', ref: 'comptoir-droit', pos: { x: 3, y: 56 }, facing: 'N' },
  { id: 'billet-d', kind: 'prop', ref: 'comptoir-droit', pos: { x: 40, y: 56 }, facing: 'N' },

  // LUSTRE central : pendu au-dessus de l'orchestre qu'il éclaire (la recette porte la hauteur, patron `applique-murale`).
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 21, y: 28 } },

  // ═══════════════ SALLES LATÉRALES GAUCHE (z=0) — DENSÉMENT meublées, pièce par pièce (plan p.40) ═══════
  // 14 SALLE VERTE / 13 VESTIAIRE (bande haute gy 1-14) : détente des artistes + coiffeuses.
  { id: 'sv-table', kind: 'prop', ref: 'table-2x1', pos: { x: 3, y: 6 } },
  // Les deux chaises sont au SUD de la table (3,6) : elles la regardent, cap N.
  { id: 'sv-chaise-1', kind: 'prop', ref: 'chaise', pos: { x: 2, y: 8 }, facing: 'N' },
  { id: 'sv-chaise-2', kind: 'prop', ref: 'chaise', pos: { x: 5, y: 8 }, facing: 'N' },
  { id: 'sv-banc-1', kind: 'prop', ref: 'banc', pos: { x: 2, y: 3 } },
  { id: 'sv-banc-2', kind: 'prop', ref: 'banc', pos: { x: 2, y: 11 } },
  // Étagère en rangée 2 : dos au mur NORD de la pièce, rayons ouverts vers la salle (cap S).
  { id: 'sv-etagere', kind: 'prop', ref: 'etagere', pos: { x: 4, y: 2 }, facing: 'S' },
  { id: 'sv-canape', kind: 'prop', ref: 'canape', pos: { x: 2, y: 13 }, facing: 'E' },
  { id: 'sv-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 8, y: 2 } },
  { id: 'sv-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 11, y: 2 } },
  { id: 'sv-miroir-1', kind: 'prop', ref: 'miroir', pos: { x: 8, y: 6 } },
  // Chaise du coin maquillage : face au miroir (8,6), deux cases à l'ouest.
  { id: 'sv-chaise-3', kind: 'prop', ref: 'chaise', pos: { x: 10, y: 6 }, facing: 'O' },
  { id: 'sv-parav', kind: 'prop', ref: 'paravent', pos: { x: 12, y: 9 } },
  { id: 'sv-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 8, y: 11 } },
  { id: 'sv-mann', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 11, y: 12 } },

  // 12 VESTIAIRES DES CHŒURS (Féminin) (gy 15-23).
  { id: 'v12-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 2, y: 16 } },
  { id: 'v12-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 5, y: 16 } },
  { id: 'v12-coif-3', kind: 'prop', ref: 'coiffeuse', pos: { x: 8, y: 16 } },
  { id: 'v12-miroir', kind: 'prop', ref: 'miroir', pos: { x: 11, y: 16 } },
  // Chaises de coiffeuse : au sud de la rangée 16 (coiffeuses 2/5/8), tournées vers elles.
  { id: 'v12-chaise-1', kind: 'prop', ref: 'chaise', pos: { x: 3, y: 18 }, facing: 'N' },
  { id: 'v12-chaise-2', kind: 'prop', ref: 'chaise', pos: { x: 6, y: 18 }, facing: 'N' },
  { id: 'v12-banc', kind: 'prop', ref: 'banc', pos: { x: 9, y: 19 } },
  { id: 'v12-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 2, y: 20 } },
  { id: 'v12-parav', kind: 'prop', ref: 'paravent', pos: { x: 5, y: 21 } },
  { id: 'v12-mann', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 8, y: 21 } },
  { id: 'v12-armoire', kind: 'prop', ref: 'armoire', pos: { x: 2, y: 22 } },

  // 11 VESTIAIRES DES CHŒURS (Masculin) (gy 24-33).
  { id: 'v11-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 2, y: 25 } },
  { id: 'v11-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 5, y: 25 } },
  { id: 'v11-miroir', kind: 'prop', ref: 'miroir', pos: { x: 8, y: 25 } },
  { id: 'v11-banc-1', kind: 'prop', ref: 'banc', pos: { x: 2, y: 27 } },
  { id: 'v11-banc-2', kind: 'prop', ref: 'banc', pos: { x: 6, y: 28 } },
  { id: 'v11-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 2, y: 30 } },
  { id: 'v11-parav', kind: 'prop', ref: 'paravent', pos: { x: 5, y: 31 } },
  { id: 'v11-armoire', kind: 'prop', ref: 'armoire', pos: { x: 2, y: 32 } },

  // 10 PASSAGE + 15 BUREAU DU RÉGISSEUR (gy 34-43).
  { id: 'reg15-bureau', kind: 'prop', ref: 'bureau-2x1', pos: { x: 2, y: 35 } },
  // Chaise à l'est du bureau (2-3, 35) : le régisseur s'y assoit face à son plateau (cap O).
  { id: 'reg15-chaise', kind: 'prop', ref: 'chaise', pos: { x: 5, y: 35 }, facing: 'O' },
  // Étagère en colonne 2 : dos au mur OUEST, rayons ouverts vers la pièce (cap E).
  { id: 'reg15-etag', kind: 'prop', ref: 'etagere', pos: { x: 2, y: 37 }, facing: 'E' },
  { id: 'reg15-coffre', kind: 'prop', ref: 'coffre', pos: { x: 5, y: 38 } },
  { id: 'p10-banc-1', kind: 'prop', ref: 'banc', pos: { x: 2, y: 40 } },
  { id: 'p10-caisse', kind: 'prop', ref: 'caisse', pos: { x: 4, y: 41 } },

  // ═══════════════ SALLES LATÉRALES DROITE (z=0) — DENSÉMENT meublées ═══════════════
  // 20 STOCKAGE DES DÉCORS (bande haute, gx30-37).
  { id: 's20-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 31, y: 2 } },
  { id: 's20-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 33, y: 2 } },
  { id: 's20-flat-3', kind: 'prop', ref: 'decor-flat', pos: { x: 35, y: 2 } },
  { id: 's20-flat-4', kind: 'prop', ref: 'decor-flat', pos: { x: 31, y: 5 } },
  { id: 's20-flat-5', kind: 'prop', ref: 'decor-flat', pos: { x: 33, y: 5 } },
  { id: 's20-charrette', kind: 'prop', ref: 'charrette', pos: { x: 35, y: 7 } },
  { id: 's20-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 31, y: 8 } },
  { id: 's20-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 33, y: 9 } },
  { id: 's20-tonneaux', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 35, y: 10 } },
  { id: 's20-mann', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 31, y: 12 } },
  { id: 's20-colonne', kind: 'prop', ref: 'colonne-brisee', pos: { x: 34, y: 12 } },

  // 22 BUREAU DU CONCIERGE / 23 GESTIONNAIRE (petites pièces NE gx37-42).
  { id: 'b22-bureau', kind: 'prop', ref: 'bureau-2x1', pos: { x: 39, y: 6 } },
  // Chaise en (38,7), au SO du bureau : le bureau occupe (39,6) et (40,6), donc TOUT le bloc est à
  // l'EST de la colonne 38 — le nord de la chaise ne donne que sur la case vide (38,6). Cap E, le seul
  // cardinal qui la tourne vers le bureau (un décor volumique n'en prend pas d'autre, #1680 ligne 3).
  { id: 'b22-chaise', kind: 'prop', ref: 'chaise', pos: { x: 38, y: 7 }, facing: 'E' },
  { id: 'b23-bureau', kind: 'prop', ref: 'bureau-2x1', pos: { x: 39, y: 11 } },
  // Étagère en colonne 38 : dos au mur OUEST des petites pièces NE (gx37-42), cap E.
  { id: 'b23-etag', kind: 'prop', ref: 'etagere', pos: { x: 38, y: 13 }, facing: 'E' },

  // 24 RANGEMENTS DES COSTUMES (gy 15-23).
  { id: 'c24-portant-1', kind: 'prop', ref: 'portant-costumes', pos: { x: 31, y: 16 } },
  { id: 'c24-portant-2', kind: 'prop', ref: 'portant-costumes', pos: { x: 34, y: 16 } },
  { id: 'c24-portant-3', kind: 'prop', ref: 'portant-costumes', pos: { x: 37, y: 16 } },
  { id: 'c24-armoire-1', kind: 'prop', ref: 'armoire', pos: { x: 40, y: 16 } },
  { id: 'c24-mann-1', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 31, y: 19 } },
  { id: 'c24-mann-2', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 34, y: 19 } },
  { id: 'c24-coffre', kind: 'prop', ref: 'coffre', pos: { x: 37, y: 20 } },
  { id: 'c24-portant-4', kind: 'prop', ref: 'portant-costumes', pos: { x: 40, y: 20 } },
  { id: 'c24-armoire-2', kind: 'prop', ref: 'armoire', pos: { x: 31, y: 22 } },

  // 25 COUTURIÈRES (gy 24-30).
  { id: 'c25-table-1', kind: 'prop', ref: 'table-2x1', pos: { x: 31, y: 25 } },
  { id: 'c25-tab-1', kind: 'prop', ref: 'tabouret', pos: { x: 34, y: 25 } },
  { id: 'c25-table-2', kind: 'prop', ref: 'table-2x1', pos: { x: 36, y: 25 } },
  { id: 'c25-mann-1', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 39, y: 25 } },
  { id: 'c25-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 31, y: 28 } },
  { id: 'c25-mann-2', kind: 'prop', ref: 'mannequin-couturier', pos: { x: 34, y: 28 } },
  // Étagère du fond de l'atelier : dos au mur SUD de la pièce (gy 24-30), face aux tables (cap N).
  { id: 'c25-etag', kind: 'prop', ref: 'etagere', pos: { x: 37, y: 28 }, facing: 'N' },
  { id: 'c25-tab-2', kind: 'prop', ref: 'tabouret', pos: { x: 40, y: 28 } },

  // 26 CHARPENTERIE + 27 RÉSERVE GÉNÉRALE (gy 31-43, côté mur extérieur gx 34-42).
  { id: 'c26-etabli', kind: 'prop', ref: 'etabli-2x1', pos: { x: 34, y: 32 } },
  { id: 'c26-scie', kind: 'prop', ref: 'scie-chevalet', pos: { x: 37, y: 32 } },
  { id: 'c26-flat', kind: 'prop', ref: 'decor-flat', pos: { x: 40, y: 32 } },
  { id: 'c26-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 39, y: 34 } },
  { id: 'r27-tonneaux-1', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 35, y: 35 } },
  { id: 'r27-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 37, y: 36 } },
  // Étagère de réserve : dos au mur EXTÉRIEUR est (colonne 40 sur gx34-42), cap O.
  { id: 'r27-etag', kind: 'prop', ref: 'etagere', pos: { x: 40, y: 36 }, facing: 'O' },
  { id: 'r27-tonneaux-2', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 36, y: 38 } },
  { id: 'r27-coffre', kind: 'prop', ref: 'coffre', pos: { x: 39, y: 39 } },
  { id: 'r27-caisse-3', kind: 'prop', ref: 'caisse', pos: { x: 38, y: 41 } },

  // ═══════════════ PREMIER ÉTAGE (z=1) — LOGES & BALCONS tiérés autour du puits ovale ═══════════════
  ...seatCol('et-Lring1', 5, 17, 31, 'E', 1),
  ...seatCol('et-Lring2', 7, 18, 30, 'E', 1),
  ...seatCol('et-Rring1', 38, 17, 31, 'O', 1),
  ...seatCol('et-Rring2', 36, 18, 30, 'O', 1),
  ...seatRow('et-balc-43', 43, 11, 19, 'N', 1), ...seatRow('et-balc-43b', 43, 23, 31, 'N', 1),
  ...seatRow('et-balc-45', 45, 9, 19, 'N', 1), ...seatRow('et-balc-45b', 45, 23, 33, 'N', 1),
  // GARDE-CORPS du puits (NADJ 08 folio 39 : le bord de balcon court tout autour de l'ovale) : une
  // travée de `balustrade-loge` par case de RIVE, cap sur le puits — la liste vient de `puitsRim`, seule
  // lecture de l'ovale, et l'id de chaque travée est celui de sa case.
  ...puitsRim().map(({ x, y, facing }): SceneEntity => ({ id: `bal-${x}-${y}`, kind: 'prop', ref: 'balustrade-loge', pos: { x, y }, facing, z: 1 })),
  { id: 'et-app-Lg1', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 20 }, z: 1 },
  { id: 'et-app-Lg2', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 28 }, z: 1 },
  { id: 'et-app-Rg1', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 20 }, z: 1 },
  { id: 'et-app-Rg2', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 28 }, z: 1 },

  // 30 LOGE ROYALE (flanc GAUCHE, contre 32 Antichambre ducale) + 29 LOGE DES NOBLES (un flanc chacune).
  { id: 'royale-canape-g', kind: 'prop', ref: 'canape', pos: { x: 7, y: 3 }, facing: 'E', z: 1 },
  { id: 'royale-canape-d', kind: 'prop', ref: 'canape', pos: { x: 11, y: 3 }, facing: 'E', z: 1 },
  { id: 'royale-fauteuil', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 9, y: 2 }, facing: 'E', z: 1 },
  { id: 'royale-app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 6, y: 1 }, z: 1 },
  { id: 'royale-app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 12, y: 1 }, z: 1 },
  { id: 'noble-g-1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 10, y: 7 }, facing: 'E', z: 1 },
  // Second fauteuil de chaque loge des nobles : la loge ne couvre PAS tout son rectangle (le puits en
  // mange le flanc) : il se pose sur une case de PLANCHER de la pièce, jamais sur le vide du puits.
  { id: 'noble-g-2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 9, y: 9 }, facing: 'E', z: 1 },
  { id: 'noble-d-1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 33, y: 7 }, facing: 'O', z: 1 },
  { id: 'noble-d-2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 34, y: 9 }, facing: 'O', z: 1 },

  // ═══════════════ GALERIE / BARS / SALONS de l'étage (z=1, débordent sur le foyer) ═══════════════
  // Les quatre comptoirs de l'étage font face au SUD : desserte au nord (étagères, tonneaux de la
  // rangée 46), buveurs au sud, du côté des tables, canapés et fauteuils.
  { id: 'salon-d-comptoir', kind: 'prop', ref: 'comptoir-droit', pos: { x: 4, y: 52 }, facing: 'S', z: 1 },
  { id: 'salon-d-table', kind: 'prop', ref: 'table', pos: { x: 6, y: 50 }, z: 1 },
  { id: 'salon-d-ft', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 5, y: 53 }, z: 1 },
  { id: 'salon-d-plante', kind: 'prop', ref: 'plante-pot', pos: { x: 3, y: 50 }, z: 1 },
  { id: 'bar-g-comptoir', kind: 'prop', ref: 'comptoir-droit', pos: { x: 16, y: 52 }, facing: 'S', z: 1 },
  { id: 'bar-g-etag', kind: 'prop', ref: 'etagere', pos: { x: 14, y: 50 }, facing: 'S', z: 1 },
  { id: 'bar-g-tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 18, y: 50 }, z: 1 },
  { id: 'salon-s-comptoir', kind: 'prop', ref: 'comptoir-droit', pos: { x: 39, y: 52 }, facing: 'S', z: 1 },
  { id: 'salon-s-table', kind: 'prop', ref: 'table', pos: { x: 37, y: 50 }, z: 1 },
  { id: 'salon-s-canape', kind: 'prop', ref: 'canape', pos: { x: 38, y: 53 }, facing: 'N', z: 1 },
  { id: 'salon-s-plante', kind: 'prop', ref: 'plante-pot', pos: { x: 40, y: 50 }, z: 1 },
  { id: 'bar-d-comptoir', kind: 'prop', ref: 'comptoir-droit', pos: { x: 27, y: 52 }, facing: 'S', z: 1 },
  { id: 'bar-d-etag', kind: 'prop', ref: 'etagere', pos: { x: 29, y: 50 }, facing: 'S', z: 1 },
  { id: 'bar-d-tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 25, y: 50 }, z: 1 },

  // Deux lustres de la galerie de l'étage, pendus dans la salle qu'ils éclairent (la recette porte la hauteur, patron `applique-murale`).
  { id: 'foy-lustre-g', kind: 'prop', ref: 'lustre-opera', pos: { x: 14, y: 49 }, z: 1 },
  { id: 'foy-lustre-d', kind: 'prop', ref: 'lustre-opera', pos: { x: 29, y: 49 }, z: 1 },
];

/** Mobilier complet du Théâtre Staatsoper, posé pièce par pièce d'après le plan officiel (donnée de QC). */
export const scenarioEntities = ents;
