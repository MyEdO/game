import { beforeAll, describe, expect, it } from 'vitest';
import { addCondition, COND } from '../../../../src/engine/conditions';
import { HEAL_SKILL } from '../../../../src/engine/healing';
import { poserLesReglesDuRoguelite, soignerUnCompagnon } from '../noyau';
import {
  agirDansLaSalle,
  avancer,
  herosDuGroupe,
  nouvellePartie,
  partir,
  recrue,
  refusDuPatient,
  refusDuSoigneur,
  soignerEnRoute,
  PROFILS,
  SOIN_EN_ROUTE,
  type Etat,
  type Heros,
} from './index';
import { blessures, recit } from './salles.testkit';

beforeAll(() => poserLesReglesDuRoguelite());

const MEDECIN = PROFILS.find((p) => p.id === 'medecin')!;
const du = (e: Etat, carriere: string, n = 0): Heros => herosDuGroupe(e).filter((h) => h.carriere === carriere)[n];
const DEJA_SOIGNE = 'A déjà reçu son soin de Blessures (une fois par rencontre)';

/** Une partie à la graine `graine` partie au Reikwald avec ses `renforts` (carrières du roster) : une cache, puis une
 *  embuscade d'un snotling, puis la suite tirée ; aucune salle n'est encore ouverte. */
function enRoute(graine: number, renforts: string[] = []): Etat {
  const e = nouvellePartie(graine);
  const venus = renforts.map((id) => recrue(e, PROFILS.find((p) => p.id === id)!));
  e.roster.push(...venus);
  expect(partir(e, 'reikwald', [...e.roster.slice(0, 4 - venus.length), ...venus].map((h) => h.c.id))).toBeNull();
  const x = e.expedition!;
  x.salles = [{ type: 'tresor', ennemis: [], faite: false }, { type: 'combat', ennemis: ['snotling'], faite: false }, ...x.salles.slice(2)];
  return JSON.parse(JSON.stringify(e)) as Etat;
}

describe('la Guérison entre deux salles', () => {
  it('le soigneur choisi soigne le blessé choisi par l’infirmerie du noyau ; seul le blessé change', () => {
    let soigne = false;
    for (let g = 1; g <= 20 && !soigne; g++) {
      const e = enRoute(g, [MEDECIN.id]);
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

  it('un jet de Guérison par patient et par rencontre : refusé ensuite, rouvert au combat suivant et pas avant (LDB 09 l.260)', () => {
    const e = enRoute(1, [MEDECIN.id]);
    const medecin = () => du(e, 'medecin');
    const soldat = () => du(e, 'soldat');
    soldat().c.wounds.current = 2;
    recit(soignerEnRoute(e, medecin().c.id, soldat().c.id));
    soldat().c.wounds.current = 2;
    expect(refusDuPatient(medecin(), soldat())).toBe(DEJA_SOIGNE);
    expect(soignerEnRoute(e, medecin().c.id, soldat().c.id)).toBe(DEJA_SOIGNE);

    expect(avancer(e)).toBeNull();
    recit(agirDansLaSalle(e, 'passer'));
    expect(refusDuPatient(medecin(), soldat())).toBe(DEJA_SOIGNE);

    expect(recit(avancer(e)!).combat?.issue).toBe('victoire');
    soldat().c.wounds.current = 2;
    expect(refusDuPatient(medecin(), soldat())).toBeNull();
  });

  it('le noyau rend le soigneur, le patient et l’acte qu’il a joués', () => {
    const e = enRoute(2, [MEDECIN.id]);
    du(e, 'soldat').c.wounds.current = 2;
    const r = soignerUnCompagnon(du(e, 'medecin').c, du(e, 'soldat').c, 5);
    expect('refus' in r ? r.refus : [r.soigneur, r.patient, r.acte]).toEqual([du(e, 'medecin').c.id, du(e, 'soldat').c.id, 'blessures']);
  });

  it('deux soigneurs : le noyau confie le soin au meilleur en Guérison ; choisir l’autre est refusé sans jet', () => {
    const e = enRoute(3, [MEDECIN.id, MEDECIN.id]);
    const [a, b] = [du(e, 'medecin', 0), du(e, 'medecin', 1)];
    a.c.wounds.current = 2; b.c.wounds.current = 2;
    const refuses = [soignerEnRoute(e, a.c.id, b.c.id), soignerEnRoute(e, b.c.id, a.c.id)].filter((r): r is string => typeof r === 'string');
    expect(refuses).toHaveLength(1);
    expect(refuses[0]).toMatch(/ est meilleur·e en Guérison : à lui ou à elle de soigner\.$/);
  });

  it('un patient meilleur en Guérison que son soigneur : la liste le refuse comme le noyau, sans jet', () => {
    const e = enRoute(6, [MEDECIN.id, MEDECIN.id]);
    const [soigneur, patient] = [du(e, 'medecin', 0), du(e, 'medecin', 1)];
    patient.c.wounds.current = 2;
    patient.c.skills.find((s) => s.id === HEAL_SKILL)!.advances += 40;
    const refus = refusDuPatient(soigneur, patient);
    expect(refus).toBe(`${patient.c.label} est meilleur·e en Guérison : à lui ou à elle de soigner.`);
    expect(soignerEnRoute(e, soigneur.c.id, patient.c.id)).toBe(refus);
    expect(du(e, 'medecin', 1).c.wounds.current).toBe(2);
  });

  it('refus : qui n’a pas Guérison ne soigne pas ; un soigneur hors de combat non plus ; rien ne se joue', () => {
    const e = enRoute(4, [MEDECIN.id]);
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
    const e = enRoute(5, [MEDECIN.id]);
    for (const h of herosDuGroupe(e)) h.c.wounds.current = h.c.wounds.max;
    const medecin = du(e, 'medecin');
    medecin.c.wounds.current = 2;
    expect(refusDuSoigneur(e, medecin)).toBe('Personne à soigner.');
    du(e, 'soldat').c.wounds.current = 2;
    expect(refusDuSoigneur(e, medecin)).toBeNull();
  });
});
