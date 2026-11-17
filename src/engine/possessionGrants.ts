/**
 * Grants de POSSESSION portés par des dotations (Classe/Carrière) — #617/#618 SOCLE POSSESSIONS.
 * `buildInventory` (engine/items.ts) ignore les dotations de possession (`{id, type}`) d'un `TrappingRef`
 * (pas des objets de sac) : ce module les MATÉRIALISE en `PossessionInput[]`, même shape que l'Effet
 * `givePossession` (noyau/combatEffects.ts) — bête, véhicule ou engin de siège `avec-le-groupe`, `count` respecté.
 */
import type { Somme, TrappingRef } from '../data';
import type { PossessionInput } from './possession';
import { rollDice, type DiceSpec, type RNG } from './dice';
import { enPieces, type Money } from './money';

/** Le nombre d'unités qu'une ref de dotation donne : `count.fixed`, `count.roll` par `tirer` (l'appelant y roule
 *  `rollDice` sur son `RNG`, #663), sinon 1. */
export function compteDeLaDotation(ref: TrappingRef, tirer: (de: DiceSpec) => number): number {
  return 'count' in ref && ref.count ? ('fixed' in ref.count ? ref.count.fixed : tirer(ref.count.roll)) : 1;
}

/** La somme `s`, son nombre de pièces tiré sur `rng` (`compteDeLaDotation`). LDB 57 */
export function sommeTiree(s: Somme, rng: RNG): Money {
  return enPieces(s.monnaie, compteDeLaDotation(s, (de) => rollDice(de, rng)));
}

/** PUR — n'écrit rien, l'appelant (noyau/possessionsFlow.ts) matérialise via `ajouterLaPossession`. Ne lit que
 *  les dotations de possession `{id, type}`. `count.fixed` spawn N
 *  possessions ; `count.roll` (dé, ex. « Bateaux de patrouille » 1d10) TIRE N via le rouleur canonique
 *  (`rollDice`, `engine/dice.ts`) sur le `RNG` seedable injecté (#663) ; sans `count`, 1 possession. */
export function possessionGrantsFromRefs(refs: TrappingRef[], ownerId: string, rng: RNG): PossessionInput[] {
  const grants: PossessionInput[] = [];
  for (const ref of refs) {
    const n = compteDeLaDotation(ref, (de) => rollDice(de, rng));
    if (!('type' in ref)) continue;
    // Objet NEUF à CHAQUE itération (jamais la même réf poussée N fois) — `ajouterLaPossession` ne fait
    // qu'un spread SUPERFICIEL (`{...p, uid}`, possessionsFlow.ts) : un `items`/`location` partagé
    // entre N possessions dupliquées les ferait muter ensemble (embarquer sur l'une affecterait
    // les autres).
    const neuve = (): PossessionInput => {
      const commun = { ownerId, location: { kind: 'avec-le-groupe' } as const, items: [], ...(ref.label ? { label: ref.label } : {}) };
      switch (ref.type) {
        case 'vehicle':
          return { nature: 'vehicule', vehicleId: ref.id, ...commun };
        case 'creature':
          return { nature: 'bete', ref: { id: ref.id }, ...commun };
        case 'engin':
          return { nature: 'engin', trappingId: ref.id, ...commun };
      }
    };
    for (let i = 0; i < n; i++) grants.push(neuve());
  }
  return grants;
}
