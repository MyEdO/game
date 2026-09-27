/**
 * Def d'ARME unifié — 1 arme = 1 fichier `defs/<slug>.ts` (registre auto-chargé, cf.
 * scripts/gen-registry.mjs). Réunit la FORME (métadonnées) et l'ART (silhouette) dans une
 * seule source de vérité par arme — comme les parts monstrueuses / tenues.
 *
 * `art` : SVG dans le repère local de l'os `arme` (manche à l'origine (0,0), lame/tête vers -y).
 *
 * SKINS d'objets uniques/légendaires (futur) : `art` peut porter des `@tokens` de couleur
 * (même mécanisme que les parts monstrueuses, cf. `parts/monstrous.ts` : `@peau`, `@metal`…)
 * et `palette` fournit la table par défaut token→couleur. Un objet légendaire (ItemInstance)
 * pourra alors override `palette` pour un skin personnalisé sans toucher au def.
 */
import type { RigHeldDef } from '../types';
import type { PaletteDeCouchePortee } from '../../palette';

/** Def d'ARME = base commune `RigHeldDef` (slug/label/target/art, comme les boucliers) + métadonnées
 *  de COMBAT. `art` (hérité) peut porter des `@tokens` palette (skins légendaires) résolus via `palette`. */
export interface WeaponDef extends RigHeldDef {
  type: 'melee' | 'ranged';
  /** Groupe canonique WFRP4 (subType) — métadonnée de FORME (l'anim, elle, passe par handling.ts). */
  group: string;
  /** Table par défaut token→couleur pour les `@tokens` de `art` (override possible par objet légendaire). */
  palette?: PaletteDeCouchePortee;
}
