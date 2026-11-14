import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { nouvelEntete, ouvrirLaPartie } from './partie';
import { projeter } from './projection';
import { porteurDObjetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { frenzyTarget } from '../noyau/combatFlow';
import type { Combatant } from '../engine/types';

describe('projection d’un objet de campagne', () => {
  it('publie l’apparence de naissance, tenue en main, sur l’actif et dans la liste des combattants', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const base = partie.etat();
      const { hero, narratif, candidats } = porteurDObjetDeCampagne(idsDeTest, 'hache_naine');
      const ancien = base.battle!.combatants.find((c) => c.kind === 'heros')!;
      hero.id = ancien.id;
      hero.pos = ancien.pos;
      const etat = {
        ...base, campaignNarratif: narratif,
        party: base.party.map((c) => c.id === hero.id ? hero : c),
        battle: {
          ...base.battle!,
          combatants: base.battle!.combatants.map((c) => c.id === hero.id ? hero : c),
          order: [hero.id, ...base.battle!.order.filter((id) => id !== hero.id)], turn: 0,
        },
      };
      const vue = projeter(etat, 0, 0, { autres: 100, offres: 100, cibles: 100, gestes: 100, entites: 100 });
      expect(candidats).toEqual(['hache_naine', 'hache']);
      const tenue = expect.objectContaining({ cle: { champ: 'apparence', id: 'hache_naine', racine: 'hache' }, point: 'main' });
      expect(vue.combat!.actif!.portee?.portees).toContainEqual(tenue);
      expect(vue.combat!.voisins.liste.find((c) => c.id === hero.id)!.portee?.portees).toContainEqual(tenue);
    } finally {
      partie.fermer();
    }
  });
});

describe('projection des cibles du Tab (`combat.cibles`)', () => {
  it('Frénésie, deux adversaires adjacents : seule la cible imposée est publiée (LDB 21 l.33)', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const base = partie.etat(); // pause de début de Round ouverte : refermée ci-dessous
      const heros = { ...base.battle!.combatants.find((c) => c.kind === 'heros')!, pos: { x: 6, y: 6 }, engagedWith: [], psychState: [{ type: 'frenesie' }] } as Combatant;
      const modele = base.battle!.combatants.find((c) => c.kind === 'ennemi')!;
      const proche = { ...modele, id: 'adverse-est', label: 'Est', pos: { x: 7, y: 6 }, engagedWith: [] } as Combatant;
      const autre = { ...modele, id: 'adverse-ouest', label: 'Ouest', pos: { x: 5, y: 6 }, engagedWith: [] } as Combatant;
      const combatants = [heros, proche, autre];
      const etat = { ...base, pendingRoundStart: null, battle: { ...base.battle!, combatants, order: combatants.map((c) => c.id), turn: 0, action: null, acted: false, movementUsed: 0, preview: null } };
      const imposee = frenzyTarget(() => etat, heros)!;
      expect([proche.id, autre.id], 'témoin : la Frénésie impose l’un des deux').toContain(imposee.id);
      const vue = projeter(etat, 0, 0, { autres: 100, offres: 100, cibles: 100, gestes: 100, entites: 100 });
      expect(vue.combat!.barre.forme, 'témoin : la barre du tour est ouverte').toBe('ouverte');
      expect(vue.combat!.cibles.liste).toEqual([imposee.id]);
    } finally {
      partie.fermer();
    }
  });
});
