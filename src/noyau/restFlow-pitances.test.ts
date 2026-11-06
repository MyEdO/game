import { describe, it, expect } from 'vitest';
import { foodOptions, nourrituresDeTroupe, type RestPlaces } from './restFlow';
import { itemFromTrappingById } from '../engine/items';
import type { Combatant } from '../engine/types';

const sansRation = { items: [] } as unknown as Combatant;
const avecRation = { items: [itemFromTrappingById('ration')!] } as unknown as Combatant;
const LIEUX: [string, RestPlaces][] = [['auberge', { auberge: true }], ['maison', { maison: true }], ['plein air', { camp: true }], ['auberge et maison', { auberge: true, maison: true }]];

describe('pitances du repos : le choix de troupe et celui du héros ont une source (#3059)', () => {
  it('le choix « pour toute la troupe » est le choix d’un héros sans ration, partout', () => {
    for (const [nom, lieu] of LIEUX) expect(nourrituresDeTroupe(lieu), nom).toEqual(foodOptions(lieu, sansRation));
  });

  it('la ration est personnelle : offerte au héros qui en porte une, jamais au choix de troupe', () => {
    for (const [nom, lieu] of LIEUX) {
      expect(foodOptions(lieu, avecRation), nom).toContain('ration');
      expect(foodOptions(lieu, avecRation).filter((f) => f !== 'ration'), nom).toEqual(nourrituresDeTroupe(lieu));
    }
  });
});
