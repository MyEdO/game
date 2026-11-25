import { beforeAll, describe, expect, it } from 'vitest';
import { poserLesReglesDuRoguelite } from '../noyau';
import {
  agirDansLaSalle,
  avancer,
  CAMP,
  DESTINATIONS,
  EPREUVES,
  nouvellePartie,
  partir,
  salleAChoisir,
  type Etat,
} from './index';
import { devant, recit } from './salles.testkit';

beforeAll(() => poserLesReglesDuRoguelite());

describe('le camp, salle à choix', () => {
  it('entrer ouvre le camp sans repos d’office ; se reposer le lève', () => {
    const e = devant('camp', 1);
    expect(salleAChoisir(e)).toBe(true);
    const r = recit(agirDansLaSalle(e, 'reposer'));
    expect(r.lignes[0]).toBe(CAMP.reposer.recit);
    expect(e.expedition!.index).toBe(1);
    expect(salleAChoisir(e)).toBe(false);
  });
});

describe('la rencontre, salle à choix', () => {
  const reikwald = DESTINATIONS.find((d) => d.id === 'reikwald')!;

  it('parlementer : le Test de Charme du héros choisi ; réussi, une bourse ; raté, une part de l’or de l’expédition perdue', () => {
    const issues = new Set<boolean>();
    for (let g = 1; g <= 30 && issues.size < 2; g++) {
      const e = devant('rencontre', g);
      e.expedition!.or = 100;
      const choisi = e.expedition!.groupe[1];
      const r = recit(agirDansLaSalle(e, 'parlementer', choisi)).epreuve!;
      issues.add(r.reussite);
      expect([r.testeur, r.competence]).toEqual([choisi, 'Charme']);
      expect(r.or).toBe(r.reussite ? e.expedition!.or - 100 : -Math.round(0.5 * reikwald.or));
      expect(e.expedition!.or).toBe(100 + r.or);
      expect(r.dit).toBe(r.reussite ? EPREUVES.rencontre.actions.parlementer.reussite : EPREUVES.rencontre.actions.parlementer.echec);
      expect(e.expedition!.index).toBe(1);
    }
    expect(issues).toEqual(new Set([true, false]));
  });

  it('intimider : le Test d’Intimidation ; raté, il se raconte d’abord, puis « avancer » livre le combat contre ceux que la rencontre déclare', () => {
    const intimider = EPREUVES.rencontre.actions.intimider;
    if (intimider.consequence.type !== 'combat') throw new Error('intimider : une conséquence de combat');
    const declares = [...intimider.consequence.adversaires].sort();
    const issues = new Set<boolean>();
    for (let g = 1; g <= 30 && issues.size < 2; g++) {
      const e = devant('rencontre', g);
      const choisi = e.expedition!.groupe[0];
      const r = recit(agirDansLaSalle(e, 'intimider', choisi));
      issues.add(r.epreuve!.reussite);
      expect([r.epreuve!.testeur, r.epreuve!.competence]).toEqual([choisi, 'Intimidation']);
      expect(r.epreuve!.or > 0).toBe(r.epreuve!.reussite);
      expect(r.combat).toBeUndefined();
      expect(!!r.combatAVenir).toBe(!r.epreuve!.reussite);
      if (r.epreuve!.reussite) { expect(e.expedition!.index).toBe(1); continue; }
      expect([e.expedition!.index, salleAChoisir(e)]).toEqual([0, false]);
      expect(agirDansLaSalle(e, 'intimider', choisi)).toBe('Aucune action en attente.');
      const combat = recit(avancer(JSON.parse(JSON.stringify(e)) as Etat)!).combat!;
      expect(combat.pas[0].pions.filter((p) => p.camp === 'ennemi').map((p) => p.creature).sort()).toEqual(declares);
    }
    expect(issues).toEqual(new Set([true, false]));
  }, 60_000);

  it('ignorer : ni Test, ni or, la salle franchie', () => {
    const e = devant('rencontre', 5);
    expect(recit(agirDansLaSalle(e, 'passer'))).toEqual({ titre: EPREUVES.rencontre.titre, lignes: [EPREUVES.rencontre.passer.recit] });
    expect(e.expedition!.or).toBe(0);
    expect(e.expedition!.index).toBe(1);
  });

  it('le tirage des salles : un combat d’abord, un camp avant le maître, une rencontre au plus par expédition', () => {
    let vues = 0;
    for (let g = 1; g <= 60; g++) {
      const e = nouvellePartie(g);
      e.batiments.cartographe = 3;
      for (const d of DESTINATIONS) {
        expect(partir(e, d.id, [e.roster[0].c.id])).toBeNull();
        const types = e.expedition!.salles.map((s) => s.type);
        const n = types.filter((t) => t === 'rencontre').length;
        expect(n).toBeLessThanOrEqual(1);
        expect([types[0], types[types.length - 2], types[types.length - 1]], `graine ${g}, ${d.id}`).toEqual(['combat', 'camp', 'boss']);
        vues += n;
        e.expedition = null;
      }
    }
    expect(vues).toBeGreaterThan(0);
  });
});
