/**
 * Golden des CALQUES monstrueux cornes/queue en 3 vues (front/back/profile) — filet anti-régression
 * de l'art ORIENTÉ des overlays. Comble un TROU : aucune entrée de `creatures.json` ne câble
 * cornes/queue (c'est une feature d'AUTHORING — éditeur/scène/mutation posent `appearance.monster`),
 * donc le golden du bestiaire ne les couvrait pas. Résultat : un art de PROFIL cassé (cornes de face
 * plaquées sur une tête tournée) a pu vivre longtemps sans qu'un test ne bronche. Ce golden fige les
 * 3 vues de chaque tête portant cornes/queue → toute régression du `viewOrFront`/de l'art se voit.
 */
import { describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { VIEWS } from '../facing';
import type { MonsterParts } from '../parts/monstrous';
import { asRigSpeciesId } from '../appearance';

const SEED = 4;
const CASES: [string, MonsterParts][] = [
  ['taureau+cornes', { tete: 'taureau', cornes: true }],
  ['demon+cornes', { tete: 'demon', cornes: true }],
  ['caprin+cornes', { tete: 'caprin', cornes: true }],
  ['gobelin+cornes', { tete: 'gobelin', cornes: true }],
  ['rat+queue', { tete: 'rat', queue: true }],
  ['générique+cornes', { cornes: true }], // tête sans cornes déclarées → repli GENERIC_CORNES orienté
  ['générique+queue', { queue: true }],
];

describe('golden — calques monstrueux cornes/queue orientées (front/back/profile)', () => {
  for (const [label, monster] of CASES)
    for (const view of VIEWS)
      it(`${label} / ${view}`, () => {
        const svg = bonesToSvg(resolveRig(
          { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: SEED, monster },
          { weapons: [], armour: [] }, {}, undefined, view, [],
        ));
        expect(svg).toMatchSnapshot();
      });
});
