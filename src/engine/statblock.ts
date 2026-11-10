/**
 * Statbloc PERSONNALISÉ (PNJ/bête custom d'éditeur) — foyer MOTEUR : `LivingRef` (`engine/possession.ts`)
 * porte la dualité bestiaire|custom du spawn (`spawnEnemy`, spawn.ts:347). Son type est la sortie de son schéma
 * (`customStatblockSchema`) ; `noyau/monde/scene.ts` le RE-EXPORTE pour ses consommateurs.
 */
import { CHAR_KEYS, type Characteristics } from './types';
import { makeRNG, hashSeed } from './dice';

/** Le PORTEUR DE FICHE d'un combattant spawné (#1882, `LDB 77 l.7`) : exactement UN, jamais aucun —
 *  l'absence est irreprésentable. `ref` est une créature du Bestiaire, `vehicule` une coque, `engin` un engin de
 *  siège (#2968). `presetCreature` est la CreatureData d'un preset de PNJ nommé (#671),
 *  déjà mergée par la couche campagne (`resolvePresetCreature`) ; `presetId` est l'id de ce preset (#2206).
 *  `parcours` porte une réf. du Bestiaire au parcours de carrière d'un PNJ (`porterAuParcours`, #773). */
export type PorteurDeFiche =
  | (SansPorteur<'ref' | 'parcours'> & { ref: string; parcours?: import('./pnjDeCarriere').ParcoursDeCarriere })
  | (SansPorteur<'vehicule'> & { vehicule: string })
  | (SansPorteur<'engin'> & { engin: string })
  | (SansPorteur<'statblock'> & { statblock: CustomStatblock })
  | (SansPorteur<'presetCreature' | 'presetId'> & { presetCreature: import('../data').CreatureData; presetId: string });
/** Les champs des AUTRES porteurs de fiche que `K`, absents. */
type SansPorteur<K extends string> = { [C in Exclude<'ref' | 'parcours' | 'vehicule' | 'engin' | 'statblock' | 'presetCreature' | 'presetId', K>]?: never };

/** Le statbloc personnalisé, forme de sortie de son schéma (`customStatblockSchema`). */
export type CustomStatblock = import('zod').z.output<typeof import('../data/schemas/defs-scenes/communs').customStatblockSchema>;

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
