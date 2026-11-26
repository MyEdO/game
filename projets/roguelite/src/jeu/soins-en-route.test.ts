import { beforeAll, describe, expect, it } from 'vitest';
import { addCondition, COND } from '../../../../src/engine/conditions';
import { HEAL_SKILL } from '../../../../src/engine/healing';
import { poserLesReglesDuRoguelite, soignerUnCompagnon } from '../noyau';
import {
  agirDansLaSalle,
  avancer,
  herosDuGroupe,
  refusDuPatient,
  refusDuSoigneur,
  soignerEnRoute,
  PROFILS,
  SOIN_EN_ROUTE,
  type Etat,
  type Heros,
  type Salle,
} from './index';
import { blessures, enRoute, recit } from './salles.testkit';

beforeAll(() => poserLesReglesDuRoguelite());

const MEDECIN = PROFILS.find((p) => p.id === 'medecin')!;
const du = (e: Etat, carriere: string, n = 0): Heros => herosDuGroupe(e).filter((h) => h.carriere === carriere)[n];
const DEJA_SOIGNE = 'A déjà reçu son soin de Blessures (une fois par rencontre)';
/** Une embuscade d'un snotling, une cache, puis une autre embuscade d'un snotling. */
const ROUTE: Salle[] = [
  { type: 'combat', ennemis: ['snotling'], faite: false },
  { type: 'tresor', ennemis: [], faite: false },
  { type: 'combat', ennemis: ['snotling'], faite: false },
];
const route = (graine: number, renforts: string[]) => enRoute(graine, ROUTE, renforts);

describe('la Guérison entre deux salles', () => {
  it('le soigneur choisi soigne le blessé choisi par l’infirmerie du noyau ; seul le blessé change', () => {
    let soigne = false;
    for (let g = 1; g <= 20 && !soigne; g++) {
      const e = route(g, [MEDECIN.id]);
      du(e, 'soldat').c.wounds.current = 2;
      const avant = blessures(e);
      const r = recit(soignerEnRoute(e, du(e, 'medecin').c.id, du(e, 'soldat').c.id));
      expect(r.titre).toBe(SOIN_EN_ROUTE.titre);
      for (const [id, w] of blessures(e)) if (id !== du(e, 'soldat').c.id) expect(w, id).toBe(avant.get(id));
      expect(e.expedition!.index).toBe(0);
      soigne = du(e, 'soldat').c.wounds.current > 2;
    }
    expect(soigne).toBe(true);
  });

  it('un jet de Guérison par patient après un combat, refusé jusqu’au combat suivant, réarmé après lui (LDB 09 l.260)', () => {
    for (const graine of [1, 2, 3]) {
      const e = route(graine, [MEDECIN.id]);
      const medecin = () => du(e, 'medecin');
      const soldat = () => du(e, 'soldat');
      expect(recit(avancer(e)!).combat?.issue, `graine ${graine}`).toBe('victoire');
      soldat().c.wounds.current = 2;
      recit(soignerEnRoute(e, medecin().c.id, soldat().c.id));
      soldat().c.wounds.current = 2;
      expect(refusDuPatient(medecin(), soldat())).toBe(DEJA_SOIGNE);
      expect(soignerEnRoute(e, medecin().c.id, soldat().c.id)).toBe(DEJA_SOIGNE);

      expect(avancer(e)).toBeNull();
      recit(agirDansLaSalle(e, 'passer'));
      expect(refusDuPatient(medecin(), soldat())).toBe(DEJA_SOIGNE);

      expect(recit(avancer(e)!).combat?.issue, `graine ${graine}`).toBe('victoire');
      soldat().c.wounds.current = 2;
      expect(refusDuPatient(medecin(), soldat())).toBeNull();
      recit(soignerEnRoute(e, medecin().c.id, soldat().c.id));
      expect(refusDuPatient(medecin(), soldat())).toBe(DEJA_SOIGNE);
    }
  }, 60_000);

  it('le noyau rend le soigneur, le patient et l’acte qu’il a joués', () => {
    const e = route(2, [MEDECIN.id]);
    du(e, 'soldat').c.wounds.current = 2;
    const r = soignerUnCompagnon(du(e, 'medecin').c, du(e, 'soldat').c, 5);
    expect('refus' in r ? r.refus : [r.soigneur, r.patient, r.acte]).toEqual([du(e, 'medecin').c.id, du(e, 'soldat').c.id, 'blessures']);
  });

  it('deux soigneurs : le noyau confie le soin au meilleur en Guérison ; choisir l’autre est refusé sans jet', () => {
    const e = route(3, [MEDECIN.id, MEDECIN.id]);
    const [a, b] = [du(e, 'medecin', 0), du(e, 'medecin', 1)];
    a.c.wounds.current = 2; b.c.wounds.current = 2;
    const refuses = [soignerEnRoute(e, a.c.id, b.c.id), soignerEnRoute(e, b.c.id, a.c.id)].filter((r): r is string => typeof r === 'string');
    expect(refuses).toHaveLength(1);
    expect(refuses[0]).toMatch(/ est meilleur·e en Guérison : à lui ou à elle de soigner\.$/);
  });

  it('un patient meilleur en Guérison que son soigneur : la liste le refuse comme le noyau, sans jet', () => {
    const e = route(6, [MEDECIN.id, MEDECIN.id]);
    const [soigneur, patient] = [du(e, 'medecin', 0), du(e, 'medecin', 1)];
    patient.c.wounds.current = 2;
    patient.c.skills.find((s) => s.id === HEAL_SKILL)!.advances += 40;
    const refus = refusDuPatient(soigneur, patient);
    expect(refus).toBe(`${patient.c.label} est meilleur·e en Guérison : à lui ou à elle de soigner.`);
    expect(soignerEnRoute(e, soigneur.c.id, patient.c.id)).toBe(refus);
    expect(du(e, 'medecin', 1).c.wounds.current).toBe(2);
  });

  it('refus : qui n’a pas Guérison ne soigne pas ; un soigneur hors de combat non plus ; rien ne se joue', () => {
    const e = route(4, [MEDECIN.id]);
    const soldat = du(e, 'soldat');
    const medecin = du(e, 'medecin');
    soldat.c.wounds.current = 2;
    expect(refusDuSoigneur(e, soldat)).toBe('Ne sait pas tenter la Guérison.');
    expect(soignerEnRoute(e, soldat.c.id, medecin.c.id)).toBe('Ne sait pas tenter la Guérison.');
    medecin.c.wounds.current = 2;
    expect(soignerEnRoute(e, medecin.c.id, medecin.c.id)).toBe('Le soigneur soigne un autre héros.');
    medecin.c.wounds.current = medecin.c.wounds.max;
    addCondition(medecin.c, COND.inconscient);
    expect(soignerEnRoute(e, medecin.c.id, soldat.c.id)).toBe('Hors de combat.');
    expect(du(e, 'soldat').c.wounds.current).toBe(2);
  });

  it('un soigneur sans autre héros à soigner n’en est pas un : seul blessé, il ne se propose pas', () => {
    const e = route(5, [MEDECIN.id]);
    for (const h of herosDuGroupe(e)) h.c.wounds.current = h.c.wounds.max;
    const medecin = du(e, 'medecin');
    medecin.c.wounds.current = 2;
    expect(refusDuSoigneur(e, medecin)).toBe('Personne à soigner.');
    du(e, 'soldat').c.wounds.current = 2;
    expect(refusDuSoigneur(e, medecin)).toBeNull();
  });
});
