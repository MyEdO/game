/**
 * Statbloc PERSONNALISÉ (PNJ/bête custom d'éditeur) — foyer MOTEUR : `LivingRef` (`engine/possession.ts`)
 * porte la dualité bestiaire|custom du spawn (`spawnEnemy`, spawn.ts:347), d'où le besoin d'un type
 * engine-pur (règle 3). `state/scene.ts` le RE-EXPORTE pour ses consommateurs.
 */
import { CHAR_KEYS, type CharKey, type Characteristics } from './types';
import type { TraitInstance } from './statEntry';
import type { SizeCategory } from './size';
import { makeRNG, hashSeed } from './dice';

/** Le PORTEUR DE FICHE d'un combattant spawné (#1882, `LDB 77 l.7`) : exactement UN, jamais aucun —
 *  l'absence est irreprésentable. `presetCreature` est la CreatureData d'un preset de PNJ nommé (#671),
 *  déjà mergée par la couche campagne (`resolvePresetCreature`). */
export type PorteurDeFiche =
  | { ref: string; statblock?: never; presetCreature?: never }
  | { statblock: CustomStatblock; ref?: never; presetCreature?: never }
  | { presetCreature: import('../data').CreatureData; ref?: never; statblock?: never };

export interface CustomStatblock {
  /** Type de document EMBARQUÉ (#1467 L1b) : le profil s'annonce dans la donnée, jamais hydraté en
   *  mémoire — un statbloc extrait d'un projet reste identifiable hors de son porteur. */
  type: 'statblock';
  label: string;
  char: Partial<Record<CharKey | 'M' | 'B', number>>;
  weaponDamage?: string; // ex. "+BF+4"
  armour?: number; // PA uniforme sur toutes localisations
  /** Traits du profil custom, STRUCTURÉS (`TraitInstance` : id + value/arg) — édités par picker. */
  traits?: TraitInstance[];
  /** Catégorie de Taille (LDB 85) — sinon dérivée du trait « Taille (X) », défaut Moyenne. */
  size?: SizeCategory;
  /** Groupes d'appartenance manuels supplémentaires (Sigmarite, Cultiste…) pour les Traits psy ciblés (LDB 21). */
  groups?: string[];
  /** Sorts connus (ids de spells.json) — choix d'AUTEUR ; l'IA incante les Projectiles magiques. */
  spells?: string[];
  /** Compétences STRUCTURÉES (`SkillRef` : id stable + valeur de Test FINALE) → avances dérivées au
   *  spawn (valeur − Caractéristique, inverse de LDB 09). */
  skills?: import('../data').SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` : id stable + spécialisation/niveau). */
  talents?: import('../data').TalentRef[];
  /** Caractéristiques aléatoires au spawn (LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10 »). */
  randomChars?: boolean;
  /** Objet INERTE servi (affût d'artillerie d'un emplacement, AA/MDG 12) : ciblable mais sans réaction de
   *  combat (`isInanimate`) ni tour propre — son arme se sert via `postes`. Se rend par son espèce (engin). */
  inert?: boolean;
  /** Ce PNJ suit-il les règles de PERSONNAGE (#143 — Corruption LDB 19, composant d'incantation LDB 46,
   *  Tests de fin de combat Maladie/Corruption LDB 18/20) — un PNJ humain hostile MODÉLISÉ (ex. sorcier
   *  ennemi nommé) le peut ; une créature générique ne l'est pas. Propagé au spawn (`Combatant.followsCharacterRules`,
   *  prédicat unique `engine/relations.ts`). Absent/`false` = créature (défaut RAW-défendable). */
  followsCharacterRules?: boolean;
}

/** Caractéristiques aléatoires (LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10. Une Caractéristique de 30
 *  se traduit donc par 2d10+20. Si une Caractéristique vaut 5, lancez juste 1d10 ») — graine STABLE
 *  dérivée de l'id (déterministe, rejouable). Utilisée au spawn (`randomChars`) ET par le tirage figé
 *  d'une Possession (`charsRolled`, LDB 77 l.108 — seedé sur l'`uid` d'instance, jamais relancé). */
export function randomizeChars(chars: Characteristics, id: string): Characteristics {
  const rng = makeRNG(hashSeed(`rand:${id}`));
  const out = { ...chars };
  for (const k of CHAR_KEYS) {
    const v = out[k];
    if (v === 5) out[k] = rng.int(1, 10); // cas du livre : « Si une Caractéristique vaut 5 »
    else if (v > 0) out[k] = v - 10 + rng.int(1, 10) + rng.int(1, 10);
  }
  return out;
}
