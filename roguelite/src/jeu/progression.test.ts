import { describe, expect, it } from 'vitest';
import { acheterUnPas, ameliorer, nouvellePartie, offresDeCarriere, planVersLeNiveau, prixDuPas, recrue, suivreLePlan, PROFILS, type Etat, type Heros } from './index';
import { porterAuNiveau } from '../noyau';
import { advanceCost } from '../../../src/engine/advancement';

/** Un Soldat recruté au niveau `niveau`, la salle d'armes bâtie par le jeu (`ameliorer`) jusqu'à enseigner le niveau 3. */
function soldat(niveau: number, xp: number): { e: Etat; h: Heros } {
  const e = nouvellePartie(7);
  e.or = 10_000; e.trophees = 10;
  expect(ameliorer(e, 'salle')).toBeNull();
  expect(ameliorer(e, 'salle')).toBeNull();
  const h = recrue(e, PROFILS.find((p) => p.id === 'soldat')!);
  h.c = porterAuNiveau(h.c, niveau, 99);
  h.c.xp = xp;
  e.roster.push(h);
  return { e, h };
}

const corpsACorps = { genre: 'competence', ref: { id: 'corps-a-corps', spec: 'base' } } as const;
const augmentations = (h: Heros) => h.c.skills.find((s) => s.id === 'corps-a-corps' && s.spec === 'base')!.advances;

describe('progression : pas de +5', () => {
  it('un pas coûte la somme des cinq prix du noyau et monte la Compétence de 5', () => {
    const { e, h } = soldat(1, 1000);
    const avant = augmentations(h);
    const prix = Array.from({ length: 5 }, (_, i) => advanceCost(avant + i, 'competence', true)).reduce((s, x) => s + x, 0);
    expect(prixDuPas(h, corpsACorps)).toBe(prix);
    expect(acheterUnPas(e, h.c.id, corpsACorps)).toEqual({ fois: 5, cout: prix, refus: null });
    expect(augmentations(h)).toBe(avant + 5);
    expect(h.c.xp).toBe(1000 - prix);
  });

  it('PX insuffisants : le pas s’arrête et ne débite que ce qui a été acheté', () => {
    const { e, h } = soldat(1, 0);
    const avant = augmentations(h);
    const deux = advanceCost(avant, 'competence', true) + advanceCost(avant + 1, 'competence', true);
    h.c.xp = deux + 1;
    const r = acheterUnPas(e, h.c.id, corpsACorps);
    expect(r).toMatchObject({ fois: 2, cout: deux });
    expect(r.refus).toBeTruthy();
    expect(augmentations(h)).toBe(avant + 2);
    expect(h.c.xp).toBe(1);
  });
});

describe('progression : plan conseillé', () => {
  it('le plan d’un Soldat de niveau 1, suivi avec assez de PX, le passe au niveau 2 au prix annoncé', () => {
    const { e, h } = soldat(1, 2000);
    const plan = planVersLeNiveau(h);
    expect(plan.etapes[plan.etapes.length - 1]).toMatchObject({ genre: 'niveau' });
    const r = suivreLePlan(e, h.c.id);
    expect(r.refus).toBeNull();
    expect(h.c.careerLevel).toBe(2);
    expect(r.cout).toBe(plan.total);
    expect(h.c.xp).toBe(2000 - plan.total);
  });

  it('avec peu de PX, le plan s’achète dans l’ordre jusqu’à épuisement', () => {
    const { e, h } = soldat(1, 0);
    const plan = planVersLeNiveau(h);
    const premiere = plan.etapes[0];
    h.c.xp = premiere.cout + 1;
    const r = suivreLePlan(e, h.c.id);
    expect(r.refus).toBeTruthy();
    expect(r.achats[0]).toEqual(premiere);
    expect(r.achats.length).toBeLessThanOrEqual(2);
    expect(h.c.careerLevel).toBe(1);
    expect(h.c.xp).toBe(premiere.cout + 1 - r.cout);
  });

  it('le plan préfère une Compétence utile à Musicien et Pari quand les deux complètent l’exigence', () => {
    const { h } = soldat(2, 0);
    const offertes = offresDeCarriere(h).competences;
    expect(offertes.find((k) => k.ref.id === 'musicien')?.utile).toBe(false);
    expect(offertes.find((k) => k.ref.id === 'survie-en-exterieur')?.utile).toBe(true);
    const competences = planVersLeNiveau(h).etapes.flatMap((x) => (x.genre === 'competence' ? [x.ref.id] : []));
    expect(competences).toContain('survie-en-exterieur');
    expect(competences).not.toContain('musicien');
    expect(competences).not.toContain('pari');
  });
});
