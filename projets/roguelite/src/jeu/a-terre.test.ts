import { beforeAll, describe, expect, it } from 'vitest';
import { addCondition, COND } from '../../../../src/engine/conditions';
import { determinationDe, poserLaDetermination } from '../../../../src/engine/talentEffects';
import { poserLesReglesDuRoguelite } from '../noyau';
import {
  aTerre,
  herosDuGroupe,
  nouvellePartie,
  partir,
  PROFILS,
  recrue,
  refusDeSeRelever,
  rentrer,
  seRelever,
  valide,
  type Etat,
  type Heros,
  type Salle,
} from './index';
import { enRoute, tomber } from './salles.testkit';

beforeAll(() => poserLesReglesDuRoguelite());

const ROUTE: Salle[] = [{ type: 'tresor', ennemis: [], faite: false }];
const porteATerre = (h: Heros) => h.c.conditions.some((x) => x.id === COND.aTerre);

describe('À Terre à 0 Blessure, entre deux salles (LDB 18 l.15 ; LDB 17 l.61)', () => {
  it('à 0 Blessure, le héros est À Terre et non valide ; « Se relever » coûte 1 Détermination, rend 1 Blessure, le rend valide', () => {
    const e = enRoute(1, ROUTE);
    const h = herosDuGroupe(e)[1];
    tomber(h.c);
    poserLaDetermination(h.c, 2);
    expect(aTerre(h)).toBe(true);
    expect(valide(h)).toBe(false);
    expect(refusDeSeRelever(h)).toBeNull();
    seRelever(e, h.c.id);
    const apres = herosDuGroupe(e)[1];
    expect(determinationDe(apres.c)).toBe(1);
    expect(apres.c.wounds.current).toBe(1);
    expect(porteATerre(apres)).toBe(false);
    expect(valide(apres)).toBe(true);
  });

  it('sans Détermination, « Se relever » est refusé par le verdict du noyau et ne change rien', () => {
    const e = enRoute(2, ROUTE);
    const h = herosDuGroupe(e)[1];
    tomber(h.c);
    poserLaDetermination(h.c, 0);
    const raison = refusDeSeRelever(h);
    expect(raison).toBeTruthy();
    expect(seRelever(e, h.c.id)).toBe(raison);
    expect(h.c.wounds.current).toBe(0);
    expect(porteATerre(h)).toBe(true);
    expect(valide(h)).toBe(false);
  });
});

describe('les purges du retour et des jours passés épargnent un À Terre verrouillé (LDB 18 l.15)', () => {
  /** Une partie partie avec quatre héros, un cinquième resté au hameau, une salle franchie. */
  function partieAvecUnResteAuHameau(): { e: Etat; resteAuHameau: Heros } {
    const e = nouvellePartie(3);
    const resteAuHameau = recrue(e, PROFILS[0]);
    e.roster.push(resteAuHameau);
    expect(partir(e, 'reikwald', e.roster.slice(0, 4).map((h) => h.c.id))).toBeNull();
    e.expedition!.index = 1;
    return { e, resteAuHameau };
  }

  it('au retour, le héros du groupe à 0 Blessure reste À Terre ; celui qui a des Blessures se relève', () => {
    const { e } = partieAvecUnResteAuHameau();
    const [tombe, debout] = herosDuGroupe(e);
    tomber(tombe.c);
    addCondition(debout.c, COND.aTerre);
    rentrer(e, false);
    expect(porteATerre(tombe)).toBe(true);
    expect(valide(tombe)).toBe(false);
    expect(porteATerre(debout)).toBe(false);
  });

  it('les jours passés au hameau ne relèvent pas le héros resté à 0 Blessure', () => {
    const { e, resteAuHameau } = partieAvecUnResteAuHameau();
    tomber(resteAuHameau.c);
    rentrer(e, false);
    expect(e.jour).toBeGreaterThan(1);
    expect(porteATerre(resteAuHameau)).toBe(true);
    expect(valide(resteAuHameau)).toBe(false);
  });
});
