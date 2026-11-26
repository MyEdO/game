import { beforeAll, describe, expect, it } from 'vitest';
import { poserLesReglesDuRoguelite } from '../noyau';
import {
  agirDansLaSalle,
  ameliorer,
  avancer,
  disponible,
  nouvellePartie,
  partir,
  passerLeTutoriel,
  etapeEnCours,
  rentrer,
  solderLeTutoriel,
  TAILLE_DU_GROUPE,
  voir,
  type Etat,
} from './index';

beforeAll(() => poserLesReglesDuRoguelite());

const quete = (e: Etat) => etapeEnCours(e)?.id ?? null;
const groupe = (e: Etat) => e.roster.filter(disponible).slice(0, TAILLE_DU_GROUPE).map((h) => h.c.id);

describe('la quête d’une partie neuve : le tutoriel, puis les routes jusqu’à l’Autel (#5129)', () => {
  it('le tutoriel mène du hameau à la première expédition, puis à la ruine relevée, et s’efface devant le premier maître', () => {
    const e = nouvellePartie(3);
    expect(quete(e)).toBe('auberge');
    expect(etapeEnCours(e)!.mene).toBe('relais');
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
    expect(quete(e)).toBe('maitre-reikwald');
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

  it('les réglages passent le tutoriel : la quête reprend aux routes', () => {
    const e = nouvellePartie(5);
    passerLeTutoriel(e);
    expect([e.tutoriel, quete(e)]).toEqual([null, 'maitre-reikwald']);
    voir(e, 'relais');
    expect(e.tutoriel).toBeNull();
  });
});

describe('la quête des routes (#5129)', () => {
  it('chaque route fermée s’ouvre au Cartographe, puis son maître se vainc ; l’Autel abattu, plus d’étape', () => {
    const e = nouvellePartie(6);
    passerLeTutoriel(e);
    const suite: (string | null)[] = [];
    for (const d of ['reikwald', 'tertres', 'hardes', 'autel']) {
      suite.push(quete(e));
      if (d !== 'reikwald') { e.batiments.cartographe++; suite.push(quete(e)); }
      e.bossVaincus.push(d);
    }
    suite.push(quete(e));
    expect(suite).toEqual(['maitre-reikwald', 'ouvrir-tertres', 'maitre-tertres', 'ouvrir-hardes', 'maitre-hardes', 'ouvrir-autel', 'maitre-autel', null]);
  });
});

describe('les noms des quêtes (#5129)', () => {
  it('le tutoriel est la première quête, l’Autel la dernière', () => {
    const e = nouvellePartie(8);
    expect(etapeEnCours(e)!.quete).toBe('Relever Grisefosse');
    passerLeTutoriel(e);
    expect(etapeEnCours(e)!.quete).toBe('Lisière du Reikwald');
    e.batiments.cartographe = 3;
    e.bossVaincus.push('reikwald', 'tertres', 'hardes');
    expect(etapeEnCours(e)!.quete).toBe('Abattre l’Autel du Chaos');
  });
});
