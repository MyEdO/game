import { beforeAll, describe, expect, it } from 'vitest';
import { poserLesReglesDuRoguelite } from '../noyau';
import { addCondition, COND, hasCondition } from '../../../../src/engine/conditions';
import { agirDansLaSalle, EPREUVES, herosDuGroupe, nouvellePartie, recrue, refusDAction, salleAChoisir, PROFILS } from './index';
import { blessures, devant, recit } from './salles.testkit';

beforeAll(poserLesReglesDuRoguelite);

/** La nonne de Shallya : ni la meilleure en Perception, ni la première du groupe. */
const NONNE = 1;

describe('la cache piégée, salle à choix', () => {
  it('entrer ouvre la salle sans rien jouer, et l’attente survit au rechargement', () => {
    const e = devant('tresor', 1);
    expect(salleAChoisir(e)).toBe(true);
    expect(e.expedition!.index).toBe(0);
    expect(e.expedition!.or).toBe(0);
  });

  it('fouiller : le héros choisi jette et lui seul reçoit la lame ; réussi, la bourse est prise', () => {
    const issues = new Set<boolean>();
    for (let g = 1; g <= 30 && issues.size < 2; g++) {
      const e = devant('tresor', g);
      const choisi = e.roster[NONNE].c.id;
      const avant = blessures(e);
      const r = recit(agirDansLaSalle(e, 'fouiller', choisi)).epreuve!;
      issues.add(r.reussite);
      expect(r.testeur).toBe(choisi);
      expect(r.victimes.map((v) => v.id)).toEqual(r.reussite ? [] : [choisi]);
      for (const [id, w] of blessures(e)) if (id !== choisi) expect(w).toBe(avant.get(id));
      expect(r.or > 0).toBe(r.reussite);
      expect(e.expedition!.or).toBe(r.or);
      expect(r.dit).toBe(r.reussite ? EPREUVES.tresor.actions.fouiller.reussite : EPREUVES.tresor.actions.fouiller.echec);
    }
    expect(issues).toEqual(new Set([true, false]));
  });

  it('un choix fait ne se rejoue pas : la salle est franchie, la suivante n’attend rien', () => {
    const e = devant('tresor', 3);
    recit(agirDansLaSalle(e, 'fouiller', e.roster[0].c.id));
    expect(e.expedition!.salles[0]).toMatchObject({ faite: true });
    expect(e.expedition!.salles[0].ouverte).toBeUndefined();
    expect(e.expedition!.index).toBe(1);
    expect(salleAChoisir(e)).toBe(false);
    expect(agirDansLaSalle(e, 'fouiller', e.roster[0].c.id)).toBe('Aucune action en attente.');
  });

  it('passer : ni jet, ni bourse, ni Blessure ; un récit court', () => {
    const e = devant('tresor', 4);
    const avant = blessures(e);
    const r = recit(agirDansLaSalle(e, 'passer'));
    expect(r).toEqual({ titre: EPREUVES.tresor.titre, lignes: [EPREUVES.tresor.passer.recit] });
    expect(e.expedition!.or).toBe(0);
    expect(blessures(e)).toEqual(avant);
    expect(e.expedition!.index).toBe(1);
  });

  it('désarmer : refusé à qui n’a ni Piégeage ni Crochetage, sans rien jouer ; tenté par le Chasseur', () => {
    const e = devant('tresor', 5, ['chasseur']);
    const [soldat, chasseur] = [e.roster[0], herosDuGroupe(e).find((h) => h.carriere === 'chasseur')!];
    expect(refusDAction(soldat, 'desarmer')).toBe('Ne sait tenter ni Piégeage ni Crochetage.');
    expect(agirDansLaSalle(e, 'desarmer', soldat.c.id)).toBe(refusDAction(soldat, 'desarmer'));
    expect(salleAChoisir(e)).toBe(true);
    const r = recit(agirDansLaSalle(e, 'desarmer', chasseur.c.id)).epreuve!;
    expect([r.testeur, r.competence]).toEqual([chasseur.c.id, 'Piégeage']);
  });

  it('toute carrière du roster que la carte admet joue son action sans lever', () => {
    const base = nouvellePartie(6);
    for (const p of PROFILS) {
      for (const action of ['fouiller', 'desarmer'] as const) {
        const e = devant('tresor', 6);
        const h = recrue(base, p);
        e.roster.push(h); e.expedition!.groupe.push(h.c.id);
        const r = agirDansLaSalle(e, action, h.c.id);
        expect(typeof r === 'string' ? r : r.epreuve!.testeur, `${p.id} · ${action}`).toBe(refusDAction(h, action) ?? h.c.id);
      }
    }
  });
  it('un héros hors de combat n’est pas proposé : refusé sans rien jouer, la salle reste ouverte', () => {
    const e = devant('tresor', 7);
    const h = e.roster[0];
    addCondition(h.c, COND.inconscient);
    expect(refusDAction(h, 'fouiller')).toBe('Hors de combat.');
    expect(agirDansLaSalle(e, 'fouiller', h.c.id)).toBe('Hors de combat.');
    expect(salleAChoisir(e)).toBe(true);
  });

  it('un Test que le noyau ne joue pas : ni bourse ni piège, le héros repris tel qu’il saigne, la salle reste au choix', () => {
    const e = devant('tresor', 8, ['chasseur']);
    const h = herosDuGroupe(e).find((g) => g.carriere === 'chasseur')!;
    // equilibrage 15 8 : Brisé 6, Hémorragique 2, 13 Blessures
    h.c.wounds.current = 13; addCondition(h.c, COND.brise, 6); addCondition(h.c, COND.hemorragique, 2);
    const r = recit(agirDansLaSalle(e, 'desarmer', h.c.id));
    const repris = herosDuGroupe(e).find((g) => g.c.id === h.c.id)!;
    expect(r.epreuve).toBeUndefined();
    expect(r.lignes[r.lignes.length - 1]).toBe(`${h.c.label} : hors d'action, le Test n'est pas joué.`);
    expect(hasCondition(repris.c, COND.inconscient)).toBe(true);
    expect(e.expedition!.or).toBe(0);
    expect(e.expedition!.index).toBe(0);
    expect(salleAChoisir(e)).toBe(true);
    expect(refusDAction(repris, 'desarmer')).toBe('Hors de combat.');
    expect(recit(agirDansLaSalle(e, 'fouiller', e.roster[0].c.id)).epreuve!.testeur).toBe(e.roster[0].c.id);
  });
});
