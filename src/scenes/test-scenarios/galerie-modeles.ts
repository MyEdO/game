import { pregenParty, PREGEN } from '../../data/pregens';
import { creatures, careers, trappings } from '../../data/index';
import { arena } from './_shared';
import type { TestScenario } from './_shared';
import type { Scene, SceneEntity } from '../../state/scene';
import type { MonsterPartsSel } from '../../engine/authoringAppearance';
import { sizeFromTraits } from '../../state/spawn';
import { sizeFootprint } from '../../state/footprint';

/**
 * Galerie EN JEU (exploration, SANS combat) de TOUS les modèles rendus par le monde de campagne :
 * - les créatures du bestiaire (`creatures`), routées vers leur rendu (rig / gabarit / sprite) ;
 * - **toutes les carrières** (`careers`) — un rig humain portant les vêtements de chaque carrière ;
 * - **toutes les armes** (`trappings` mêlée + distance) — un rig humain tenant chaque arme ;
 * - quelques **mutants modulaires**, et une **démo Monstrueuse 4×4**.
 *
 * **Placement par EMPREINTE (Taille)** : chaque modèle réserve un bloc N×N + une marge, et la ligne
 * passe à la suivante au-delà de `MAXW`. Les grandes créatures (Ogre 2×2, Dragon/Géant 3×3, démo 4×4)
 * ne se chevauchent donc plus avec leurs voisines. On tourne (Q/E) et zoome (molette).
 *
 * La galerie se construit au lancement (`construire`, #1692) : une créature/carrière/arme éditée au Codex
 * est dans la galerie au lancement suivant.
 */
const X0 = 2;
const Y0 = 2;
const GAP = 2; // marge entre deux modèles
const ROW_GAP = 2; // marge entre deux lignes
const MAXW = 38; // largeur cible d'une ligne (en cases) avant retour

/** Les parts monstrueuses démontrées (une variante par mutant) — hors de tout dataset. */
const MUTANTS: { label: string; monster: MonsterPartsSel }[] = [
  { label: 'tête de chien', monster: { tete: 'chien' } },
  { label: 'tête de lézard', monster: { tete: 'lezard' } },
  { label: 'pattes de chèvre', monster: { jambes: 'chevre' } },
  { label: 'tête en ogive', monster: { tete: 'ogive' } },
  { label: 'bras-tentacule', monster: { brasD: 'tentacule' } },
  { label: 'crétin', monster: { tete: 'minuscule' } },
];

function construireScene(): Scene {
  const ents: SceneEntity[] = [];
  let cx = X0;
  let cy = Y0;
  let rowH = 1; // plus grande empreinte de la ligne courante
  let maxX = X0;
  let n = 0;

  /** Pose un modèle d'empreinte `footN`×`footN` au curseur, avec retour à la ligne par empreinte. */
  const place = (base: Omit<SceneEntity, 'pos'>, footN: number): void => {
    if (cx > X0 && cx + footN - 1 > X0 + MAXW) {
      cx = X0;
      cy += rowH + ROW_GAP;
      rowH = 1;
    }
    ents.push({ ...base, pos: { x: cx, y: cy } } as SceneEntity);
    cx += footN + GAP;
    rowH = Math.max(rowH, footN);
    maxX = Math.max(maxX, cx);
  };
  /** Démarre une nouvelle section sur une ligne neuve (séparée d'une rangée vide). */
  const newSection = (): void => {
    cx = X0;
    cy += rowH + ROW_GAP + 1;
    rowH = 1;
  };

  // 1) Bestiaire complet — chaque créature à l'échelle de son empreinte (Trait Taille).
  for (const c of creatures) {
    place({ id: `cr-${n++}`, kind: 'personnage', ref: c.id, label: c.label }, sizeFootprint(sizeFromTraits(c.traits) ?? undefined));
  }
  // Démo Monstrueuse (4×4) : aucune créature LDB/ADE n'est Monstrueuse par DÉFAUT (c'est une option
  // facultative de plusieurs créatures) — on force la Taille via le statbloc ; le modèle reste le Géant.
  place(
    { id: 'cr-monstre', kind: 'personnage', ref: 'geant', statblock: { type: 'statblock', label: 'Démo — Monstrueuse 4×4', char: { B: 80 }, size: 'monstrueuse' }, label: 'Démo — Monstrueuse (4×4)' },
    4,
  );
  newSection();

  // 2) Toutes les carrières — rig humain + vêtements de la carrière (Moyenne, 1×1).
  for (const c of careers) {
    place({ id: `car-${n++}`, kind: 'personnage', ref: 'humain', label: `Carrière — ${c.label}`, appearance: { tenue: c.id }, weapon: 'epee-batarde' }, 1);
  }
  newSection();

  // 3) Toutes les armes — rig humain tenant chaque arme (mêlée + distance).
  const weapons = trappings.filter((t) => t.categorie === 'melee' || t.categorie === 'ranged');
  for (const w of weapons) {
    place({ id: `wp-${n++}`, kind: 'personnage', ref: 'humain', label: `Arme — ${w.label}`, weapon: w.id }, 1);
  }
  newSection();

  // 4) Mutants modulaires (une part monstrueuse par variante).
  for (const m of MUTANTS) {
    place({ id: `mut-${n++}`, kind: 'personnage', ref: 'mutant', label: `Mutant (${m.label})`, appearance: { monster: m.monster } }, 1);
  }

  const W = Math.max(maxX, X0 + MAXW) + 5;
  const H = cy + rowH + 4;

  const scene = arena({ id: 'test-galerie', label: 'Galerie — tous les modèles', w: W, h: H, heroStart: { x: 0, y: 0 } });
  scene.startMessage =
    `Galerie : ${creatures.length} créatures (à l'échelle de leur Taille) · ${careers.length} carrières · ${weapons.length} armes · ${MUTANTS.length} mutants · 1 démo Monstrueuse 4×4. ` +
    'Tourne (Q/E) et zoome (molette) pour inspecter. Aucun combat.';
  scene.entities = [...scene.entities, ...ents]; // conserve le heroStart d'arena
  return scene;
}

export const scenario: TestScenario = {
  id: 'galerie-modeles',
  order: 12,
  category: 'rendu',
  icon: 'scenario/gallery',
  title: 'Galerie de modèles',
  // Les comptes vivants sont dans le `startMessage` de la scène construite.
  tests: 'Tous les modèles du monde de campagne : TOUTES les créatures (empreintes par Taille) + TOUTES les carrières + TOUTES les armes de mêlée et de distance + mutants + démo Monstrueuse. Exploration, SANS combat.',
  partyNote: 'Exploration libre, aucun combat',
  construire: () => ({ party: pregenParty(PREGEN.soldat), scene: construireScene() }),
  // pas d'autoCombat : pure galerie d'exploration.
};
