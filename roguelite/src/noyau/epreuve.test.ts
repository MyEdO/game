import { describe, expect, it } from 'vitest';
import { jouerLeCombat, jouerLEpreuve, nouvelleRecrue } from './index';
import { DIFFICULTY_LABELS } from '../../../src/engine/types';
import { avancer, EPREUVES, nouvellePartie, partir, PROFILS, type Etat } from '../jeu';

const CACHE = EPREUVES.tresor.epreuve;
const recrueDu = (graine: number, carriere: string, nom: string) => nouvelleRecrue(graine, carriere, 'humains-reiklander', nom, PROFILS.find((p) => p.id === carriere)!.identite);
const groupe = () => [recrueDu(31, 'soldat', 'Hans'), recrueDu(32, 'chasseur', 'Greta'), recrueDu(33, 'ratier', 'Ulli')];
const GRAINE_REUSSIE = 7;
const GRAINE_RATEE = 1;
const GRAINE_DE_PARTIE_REUSSIE = 2;
const GRAINE_DE_PARTIE_RATEE = 1;

/** Les Blessures que la branche d'échec de la table retire, lues sur la table. */
function blessuresDuPiege(): number {
  const echec = CACHE.flux.echec;
  if (echec.kind !== 'effet' || echec.effet.type !== 'ops') throw new Error('branche d’échec hors forme');
  const op = echec.effet.ops[0];
  if (op?.op !== 'wounds' || typeof op.amount !== 'number') throw new Error('op hors forme');
  return op.amount;
}

describe('jouerLEpreuve — la cache piégée jouée par le noyau', () => {
  it('rejoue la même issue à graine fixe', () => {
    expect(jouerLEpreuve(groupe(), CACHE, GRAINE_RATEE)).toEqual(jouerLEpreuve(groupe(), CACHE, GRAINE_RATEE));
    expect(jouerLEpreuve(groupe(), CACHE, GRAINE_REUSSIE)).toEqual(jouerLEpreuve(groupe(), CACHE, GRAINE_REUSSIE));
  });

  it('réussite : un héros du groupe a jeté, le groupe revient tel qu’il est parti', () => {
    const avant = groupe();
    const r = jouerLEpreuve(avant, CACHE, GRAINE_REUSSIE);
    expect(r.reussite).toBe(true);
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(avant.map((c) => c.id)).toContain(r.testeur);
    expect(r.groupe).toEqual(avant);
  });

  it('échec : le piège retire ses Blessures à exactement un héros, sans État résiduel', () => {
    const avant = groupe();
    const r = jouerLEpreuve(avant, CACHE, GRAINE_RATEE);
    expect(r.reussite).toBe(false);
    expect(avant.map((c) => c.id)).toContain(r.testeur);
    const pertes = r.groupe.map((c) => avant.find((a) => a.id === c.id)!.wounds.current - c.wounds.current);
    expect(pertes.filter((p) => p !== 0)).toEqual([blessuresDuPiege()]);
    for (const c of r.groupe) expect(c.conditions).toEqual([]);
    const victime = r.groupe.findIndex((_, i) => pertes[i] !== 0);
    expect({ ...r.groupe[victime], wounds: avant[victime].wounds }).toEqual(avant[victime]);
  });

  it('un combat joué après l’épreuve démarre propre : seules les Blessures de la victime ont changé', () => {
    const rendu = jouerLEpreuve(groupe(), CACHE, GRAINE_RATEE).groupe;
    const temoin = groupe().map((c, i) => ({ ...c, wounds: rendu[i].wounds }));
    expect(jouerLeCombat(rendu, ['gobelin'], 3)).toEqual(jouerLeCombat(temoin, ['gobelin'], 3));
  });
});

/** Une partie neuve à la graine `graine`, sa compagnie partie au Reikwald, sa salle courante une cache. */
function devantLaCache(graine: number): Etat {
  const e = nouvellePartie(graine);
  expect(partir(e, 'reikwald', e.roster.map((h) => h.c.id))).toBeNull();
  e.expedition!.salles[0].type = 'tresor';
  return e;
}

describe('avancer — la salle tresor porte son épreuve', () => {
  it('échec : la victime avec ses Blessures avant et après, le testeur, le Test et l’or pris', () => {
    const e = devantLaCache(GRAINE_DE_PARTIE_RATEE);
    const avant = new Map(e.roster.map((h) => [h.c.id, h.c.wounds.current]));
    const orAvant = e.expedition!.or;
    const r = avancer(e).epreuve!;
    expect(r.reussite).toBe(false);
    expect([...avant.keys()]).toContain(r.testeur);
    expect([r.competence, r.difficulte]).toEqual(['Perception', DIFFICULTY_LABELS.difficile]);
    expect(r.victimes).toHaveLength(1);
    const [v] = r.victimes;
    const h = e.roster.find((x) => x.c.id === v.id)!;
    expect(v).toEqual({ id: h.c.id, avant: avant.get(h.c.id), apres: h.c.wounds.current, max: h.c.wounds.max });
    expect(v.avant - v.apres).toBe(blessuresDuPiege());
    expect(r.or).toBe(e.expedition!.or - orAvant);
  });

  it('réussite : personne n’est touché', () => {
    const r = avancer(devantLaCache(GRAINE_DE_PARTIE_REUSSIE)).epreuve!;
    expect(r.reussite).toBe(true);
    expect(r.victimes).toEqual([]);
  });
});
