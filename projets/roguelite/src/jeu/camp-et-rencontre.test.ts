import { beforeAll, describe, expect, it } from 'vitest';
import { addCondition, COND } from '../../../../src/engine/conditions';
import { soignerUnCompagnon, poserLesReglesDuRoguelite } from '../noyau';
import { HEAL_SKILL } from '../../../../src/engine/healing';
import {
  agirDansLaSalle,
  avancer,
  CAMP,
  DESTINATIONS,
  EPREUVES,
  herosDuGroupe,
  nouvellePartie,
  partir,
  refusDuPatient,
  refusDuSoigneur,
  salleAChoisir,
  PROFILS,
  type Etat,
  type Heros,
} from './index';
import { blessures, devant, recit } from './salles.testkit';

beforeAll(poserLesReglesDuRoguelite);

const MEDECIN = PROFILS.find((p) => p.id === 'medecin')!;
const du = (e: Etat, carriere: string, n = 0): Heros => herosDuGroupe(e).filter((h) => h.carriere === carriere)[n];

describe('le camp, salle à choix', () => {
  it('entrer ouvre le camp sans repos d’office ; se reposer le lève', () => {
    const e = devant('camp', 1);
    expect(salleAChoisir(e)).toBe(true);
    const r = recit(agirDansLaSalle(e, 'reposer'));
    expect(r.lignes[0]).toBe(CAMP.reposer.recit);
    expect(e.expedition!.index).toBe(1);
    expect(salleAChoisir(e)).toBe(false);
  });

  it('soigner : le soigneur choisi soigne le blessé choisi par l’infirmerie du noyau ; seul le blessé change, le camp reste ouvert', () => {
    let soigne = false;
    for (let g = 1; g <= 20 && !soigne; g++) {
      const e = devant('camp', g, [MEDECIN.id]);
      const medecin = du(e, 'medecin');
      const soldat = du(e, 'soldat');
      soldat.c.wounds.current = 2;
      const avant = blessures(e);
      const r = recit(agirDansLaSalle(e, 'soigner', medecin.c.id, soldat.c.id));
      expect(r.titre).toBe(CAMP.soigner.titre);
      for (const [id, w] of blessures(e)) if (id !== soldat.c.id) expect(w, id).toBe(avant.get(id));
      expect(salleAChoisir(e)).toBe(true);
      expect(e.expedition!.salles[0].soignes).toEqual([soldat.c.id]);
      expect(agirDansLaSalle(e, 'soigner', medecin.c.id, soldat.c.id)).toBe('Déjà soigné·e à ce camp.');
      soigne = du(e, 'soldat').c.wounds.current > 2;
    }
    expect(soigne).toBe(true);
  });

  it('le noyau rend le soigneur, le patient et l’acte qu’il a joués', () => {
    const e = devant('camp', 2, [MEDECIN.id]);
    const medecin = du(e, 'medecin');
    const soldat = du(e, 'soldat');
    soldat.c.wounds.current = 2;
    const r = soignerUnCompagnon(medecin.c, soldat.c, 5);
    expect('refus' in r ? r.refus : [r.soigneur, r.patient, r.acte]).toEqual([medecin.c.id, soldat.c.id, 'blessures']);
  });

  it('deux soigneurs : le noyau confie le soin au meilleur en Guérison ; choisir l’autre est refusé sans jet', () => {
    const e = devant('camp', 3, [MEDECIN.id, MEDECIN.id]);
    const [a, b] = [du(e, 'medecin', 0), du(e, 'medecin', 1)];
    a.c.wounds.current = 2; b.c.wounds.current = 2;
    const essais = [agirDansLaSalle(e, 'soigner', a.c.id, b.c.id), agirDansLaSalle(e, 'soigner', b.c.id, a.c.id)];
    const refuses = essais.filter((r): r is string => typeof r === 'string');
    expect(refuses).toHaveLength(1);
    expect(refuses[0]).toMatch(/ est meilleur·e en Guérison : à lui ou à elle de soigner\.$/);
    expect(e.expedition!.salles[0].soignes).toHaveLength(1);
  });

  it('un patient meilleur en Guérison que son soigneur : la liste le refuse comme le noyau, sans jet', () => {
    const e = devant('camp', 6, [MEDECIN.id, MEDECIN.id]);
    const [soigneur, patient] = [du(e, 'medecin', 0), du(e, 'medecin', 1)];
    patient.c.wounds.current = 2;
    patient.c.skills.find((s) => s.id === HEAL_SKILL)!.advances += 40;
    const refus = refusDuPatient(e, soigneur, patient);
    expect(refus).toBe(`${patient.c.label} est meilleur·e en Guérison : à lui ou à elle de soigner.`);
    expect(agirDansLaSalle(e, 'soigner', soigneur.c.id, patient.c.id)).toBe(refus);
    expect(du(e, 'medecin', 1).c.wounds.current).toBe(2);
    expect(e.expedition!.salles[0].soignes).toBeUndefined();
  });

  it('refus : qui n’a pas Guérison ne soigne pas ; un soigneur hors de combat non plus ; rien ne se joue', () => {
    const e = devant('camp', 4, [MEDECIN.id]);
    const soldat = du(e, 'soldat');
    const medecin = du(e, 'medecin');
    soldat.c.wounds.current = 2;
    expect(refusDuSoigneur(e, soldat)).toBe('Ne sait pas tenter la Guérison.');
    expect(agirDansLaSalle(e, 'soigner', soldat.c.id, medecin.c.id)).toBe('Ne sait pas tenter la Guérison.');
    medecin.c.wounds.current = 2;
    expect(agirDansLaSalle(e, 'soigner', medecin.c.id, medecin.c.id)).toBe('Le soigneur soigne un autre héros.');
    medecin.c.wounds.current = medecin.c.wounds.max;
    addCondition(medecin.c, COND.inconscient);
    expect(agirDansLaSalle(e, 'soigner', medecin.c.id, soldat.c.id)).toBe('Hors de combat.');
    expect(du(e, 'soldat').c.wounds.current).toBe(2);
    expect(e.expedition!.salles[0].soignes).toBeUndefined();
    expect(salleAChoisir(e)).toBe(true);
  });
  it('un soigneur sans autre héros à soigner n’en est pas un : seul blessé, il ne se propose pas', () => {
    const e = devant('camp', 5, [MEDECIN.id]);
    for (const h of herosDuGroupe(e)) h.c.wounds.current = h.c.wounds.max;
    const medecin = du(e, 'medecin');
    medecin.c.wounds.current = 2;
    expect(refusDuSoigneur(e, medecin)).toBe('Personne à soigner.');
    du(e, 'soldat').c.wounds.current = 2;
    expect(refusDuSoigneur(e, medecin)).toBeNull();
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

  it('le tirage des salles : une rencontre au plus par expédition, jamais en première ni en dernière salle', () => {
    let vues = 0;
    for (let g = 1; g <= 60; g++) {
      const e = nouvellePartie(g);
      e.batiments.cartographe = 3;
      for (const d of DESTINATIONS) {
        expect(partir(e, d.id, [e.roster[0].c.id])).toBeNull();
        const types = e.expedition!.salles.map((s) => s.type);
        const n = types.filter((t) => t === 'rencontre').length;
        expect(n).toBeLessThanOrEqual(1);
        expect([types[0], types[types.length - 1]]).toEqual(['combat', 'boss']);
        vues += n;
        e.expedition = null;
      }
    }
    expect(vues).toBeGreaterThan(0);
  });
});
