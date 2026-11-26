import { beforeAll, describe, expect, it } from 'vitest';
import { poserLesReglesDuRoguelite } from '../noyau';
import { agirDansLaSalle, ameliorer, avancer, disponible, nouvellePartie, partir, passerLeTutoriel, queteEnCours, rentrer, solderLeTutoriel, TAILLE_DU_GROUPE, voir, type Etat } from './index';

beforeAll(() => poserLesReglesDuRoguelite());

const quete = (e: Etat) => queteEnCours(e)?.id ?? null;
const groupe = (e: Etat) => e.roster.filter(disponible).slice(0, TAILLE_DU_GROUPE).map((h) => h.c.id);

describe('le tutoriel d’une partie neuve (#5129)', () => {
  it('mène du hameau à la première expédition, puis à la ruine relevée, et s’efface', () => {
    const e = nouvellePartie(3);
    expect(quete(e)).toBe('auberge');
    expect(queteEnCours(e)!.mene).toBe('relais');
    voir(e, 'relais');
    expect(quete(e)).toBe('forge');
    voir(e, 'forge');
    expect(quete(e)).toBe('route');
    voir(e, 'depart');
    expect(quete(e)).toBe('partir');
    expect(partir(e, 'reikwald', groupe(e))).toBeNull();
    expect(quete(e)).toBe('salle');
    while (e.expedition && !e.expedition.salles.some((s) => s.faite)) {
      const salle = e.expedition.salles[e.expedition.index];
      if (salle.ouverte) agirDansLaSalle(e, salle.type === 'camp' ? 'reposer' : 'passer');
      else avancer(e);
    }
    if (e.expedition) {
      expect(quete(e)).toBe('rentrer');
      rentrer(e, false);
    }
    expect(quete(e)).toBe('batir');
    e.or = 1000;
    expect(ameliorer(e, 'temple')).toBeNull();
    expect(quete(e)).toBeNull();
    solderLeTutoriel(e);
    expect(e.tutoriel).toBeNull();
    expect(e.journal[0]).toContain('connaît le métier');
  });

  it('une quête soldée d’avance se saute : partir sans avoir ouvert le départ solde « Choisir une route »', () => {
    const e = nouvellePartie(4);
    voir(e, 'relais'); voir(e, 'forge');
    expect(partir(e, 'reikwald', groupe(e))).toBeNull();
    expect(quete(e)).toBe('salle');
  });

  it('les réglages passent le tutoriel', () => {
    const e = nouvellePartie(5);
    passerLeTutoriel(e);
    expect([e.tutoriel, quete(e)]).toEqual([null, null]);
    voir(e, 'relais');
    expect(e.tutoriel).toBeNull();
  });
});
