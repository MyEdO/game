import { describe, it, expect } from 'vitest';
import { nouvelEntete, ouvrirLaPartie } from './partie';
import { projeter } from './projection';
import { porteurDObjetDeCampagne } from '../scenes/fixtures/objetDeCampagne';

describe('projection d’un objet de campagne', () => {
  it('publie les candidats de naissance sur l’actif et dans la liste des combattants', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }));
    try {
      const base = partie.etat();
      const { hero, narratif, candidats } = porteurDObjetDeCampagne('hache_naine');
      const ancien = base.battle!.combatants.find((c) => c.kind === 'hero')!;
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
      expect(vue.combat!.actif!.equipement.weapons[0].candidats).toEqual(candidats);
      expect(vue.combat!.voisins.liste.find((c) => c.id === hero.id)!.equipement.weapons[0].candidats).toEqual(candidats);
    } finally {
      partie.fermer();
    }
  });
});
