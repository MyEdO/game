import { beforeAll, describe, expect, it } from 'vitest';
import {
  acheter,
  acheterUnPas,
  ameliorer,
  competencesMontrees,
  nouvellePartie,
  offresDeCarriere,
  planVersLeNiveau,
  prixDuPas,
  recrue,
  suivreLePlan,
  PROFILS,
  type CibleDuPas,
  type Etat,
  type Heros,
} from './index';
import { porterAuNiveau, progression, poserLesReglesDuRoguelite } from '../noyau';
import { coutDeLAugmentation } from '../../../../src/engine/advancement';
import { casesDuNiveau } from '../../../../src/engine/casesDeCarriere';
import { heros4e, prixDuPlanAuNoyau, recrue5e } from './recrue5e.testkit';
import type { Combatant } from '../../../../src/engine/types';

beforeAll(() => poserLesReglesDuRoguelite());

/** Une recrue de `carriere` portée au niveau `niveau`, la salle d'armes bâtie par le jeu (`ameliorer`) jusqu'à
 *  enseigner le niveau 3. */
function recrueDe(carriere: string, niveau: number, xp: number): { e: Etat; h: Heros } {
  const e = nouvellePartie(7);
  e.or = 10_000; e.trophees = 10;
  expect(ameliorer(e, 'salle')).toBeNull();
  expect(ameliorer(e, 'salle')).toBeNull();
  const h = recrue(e, PROFILS.find((p) => p.id === carriere)!);
  h.c = porterAuNiveau(h.c, niveau, 99);
  h.c.xp = xp;
  e.roster.push(h);
  return { e, h };
}
const soldat = (niveau: number, xp: number) => recrueDe('soldat', niveau, xp);
/** Un Soldat 4e (`heros4e`) au roster d'une partie dont la salle d'armes est bâtie. */
function soldat4e(xp: number): { e: Etat; h: Heros } {
  const e = nouvellePartie(7);
  e.or = 10_000; e.trophees = 10;
  expect(ameliorer(e, 'salle')).toBeNull();
  const h = heros4e('soldat', 3, xp);
  e.roster.push(h);
  return { e, h };
}

const CC: CibleDuPas = { genre: 'carac', id: 'capacite-de-combat' };
const augsCC = (h: Heros) => h.c.charAdvances?.['capacite-de-combat'] ?? 0;
/** Le prix de la prochaine Augmentation de CC de `c` au noyau (`coutDeLAugmentation`). */
const prixCC = (c: Combatant): number => { const x = coutDeLAugmentation(c, { kind: 'caracteristique', char: 'capacite-de-combat' }, true); if (!x.ok) throw new Error(x.raison); return x.cout; };
/** Ce que le noyau fait payer `n` Augmentations de CC à la suite, chacune à son prix (`prixCC`) sur une copie de `h`. */
const prixNoyau = (h: Heros, n: number) => {
  const c = structuredClone(h.c);
  let total = 0;
  for (let i = 0; i < n; i++) { total += prixCC(c); c.charAdvances = { ...c.charAdvances, 'capacite-de-combat': (c.charAdvances?.['capacite-de-combat'] ?? 0) + 1 }; }
  return total;
};

describe('progression 4e : pas de +5', () => {
  it('de +3 à +5, un pas achète 2 Augmentations au prix du noyau ; de +5 à +10, il en achète 5', () => {
    const { e, h } = soldat4e(5000);
    while (augsCC(h) % 5 !== 3) expect(acheter(e, h.c.id, CC)).toBeNull();
    const trois = augsCC(h);
    const deux = prixNoyau(h, 2);
    expect(prixDuPas(h, CC)).toBe(deux);
    expect(acheterUnPas(e, h.c.id, CC)).toEqual({ fois: 2, cout: deux, refus: null });
    expect(augsCC(h)).toBe(trois + 2);
    const cinq = prixNoyau(h, 5);
    expect(prixDuPas(h, CC)).toBe(cinq);
    expect(acheterUnPas(e, h.c.id, CC)).toEqual({ fois: 5, cout: cinq, refus: null });
    expect(augsCC(h)).toBe(trois + 7);
  });

  it('PX insuffisants : le pas s’arrête au refus du noyau et ne débite que ce qui a été acheté', () => {
    const { e, h } = soldat4e(0);
    const avant = augsCC(h);
    const prix = prixCC(h.c);
    h.c.xp = prix + 1;
    const r = acheterUnPas(e, h.c.id, CC);
    expect(r).toMatchObject({ fois: 1, cout: prix });
    expect(r.refus).toBeTruthy();
    expect(augsCC(h)).toBe(avant + 1);
    expect(h.c.xp).toBe(1);
  });
});

describe('progression : plan conseillé', () => {
  it('chaque étape de Caractéristique ou de Compétence est un pas, qui finit sur un multiple de cinq', () => {
    for (const p of PROFILS) {
      const { h } = recrueDe(p.id, 1, 0);
      const augs = new Map<string, number>([
        ...progression(h.c).caracs.map((k) => [k.id, k.points] as [string, number]),
        ...progression(h.c).competences.map((k) => [`${k.ref.id}:${k.ref.spec ?? ''}`, k.points] as [string, number]),
      ]);
      for (const x of planVersLeNiveau(h).etapes) {
        if (x.genre !== 'carac' && x.genre !== 'competence') continue;
        const cle = x.genre === 'carac' ? x.id : `${x.ref.id}:${x.ref.spec ?? ''}`;
        const fin = augs.get(cle)! + x.points;
        expect(x.fois, `${p.id} ${x.label}`).toBeLessThanOrEqual(5);
        expect(fin % 5, `${p.id} ${x.label}`).toBe(0);
        augs.set(cle, fin);
      }
    }
  });

  it('suivi en un clic avec assez de PX, il passe un Soldat de niveau 1 au niveau 2 au prix annoncé', () => {
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
    const etapes = planVersLeNiveau(h).etapes.flatMap((x) => (x.genre === 'competence' ? [x.ref] : []));
    const competences = etapes.map((r) => r.id);
    expect(etapes.filter((r) => !offertes.find((k) => k.ref.id === r.id && k.ref.spec === r.spec)?.utile)).toEqual([]);
    expect(competences).not.toContain('musicien');
    expect(competences).not.toContain('pari');
  });
});

describe('progression : Compétences montrées', () => {
  it('seules les utiles, plus celles « pour le niveau » que le plan conseillé prend', () => {
    for (const p of PROFILS) {
      const { h } = recrueDe(p.id, 1, 0);
      const plan = planVersLeNiveau(h).etapes.flatMap((x) => (x.genre === 'competence' ? [`${x.ref.id}:${x.ref.spec ?? ''}`] : []));
      for (const k of competencesMontrees(h)) {
        expect(k.utile !== k.pourLeNiveau, `${p.id} ${k.label}`).toBe(true);
        if (k.pourLeNiveau) expect(plan, `${p.id} ${k.label}`).toContain(`${k.ref.id}:${k.ref.spec ?? ''}`);
      }
      const montrees = competencesMontrees(h).map((k) => `${k.ref.id}:${k.ref.spec ?? ''}`);
      expect(offresDeCarriere(h).competences.filter((k) => k.utile).every((k) => montrees.includes(`${k.ref.id}:${k.ref.spec ?? ''}`))).toBe(true);
    }
  });
});

describe('progression 5e : le même code, au barème du héros', () => {
  it('un pas de +5 achète une Augmentation de 5 points, au prix du noyau', () => {
    const { e, h } = recrue5e(5000);
    const avant = augsCC(h);
    const prix = prixCC(h.c);
    expect(prixDuPas(h, CC)).toBe(prix);
    expect(acheterUnPas(e, h.c.id, CC)).toEqual({ fois: 1, cout: prix, refus: null });
    expect(augsCC(h)).toBe(avant + 5);
  });

  it('le plan en un clic s’arrête à la validation du noyau : 10 cases au niveau 1, aux prix de `coutDeLAugmentation`', () => {
    const { e, h } = recrue5e(100_000);
    expect(progression(h.c).complet).toBe(false);
    const plan = planVersLeNiveau(h);
    const remises = new Map(offresDeCarriere(h).competences.map((k) => [`${k.ref.id}:${k.ref.spec ?? ''}`, k.remise]));
    const attendu = prixDuPlanAuNoyau(h.c, plan.etapes, remises);
    expect(plan.total).toBe(attendu);
    const r = suivreLePlan(e, h.c.id);
    expect(r.refus).toBeNull();
    expect(r.cout).toBe(plan.total);
    expect(h.c.careerLevel).toBe(2);
    expect(casesDuNiveau(h.c, 'soldat', 1)).toBe(10);
  });

  it('porté au niveau 3 par `porterAuNiveau` : 10 puis 12 cases, chaque valeur sur un multiple de 5 points', () => {
    const { h } = recrue5e(0);
    const c = porterAuNiveau(h.c, 3, 11);
    expect(c.careerLevel).toBe(3);
    expect([casesDuNiveau(c, 'soldat', 1), casesDuNiveau(c, 'soldat', 2)]).toEqual([10, 12]);
    expect(progression({ ...c, careerLevel: 2 }).complet).toBe(true);
    expect(Object.values(c.charAdvances ?? {}).filter((n) => n % 5)).toEqual([]);
    expect(c.skills.filter((s) => s.advances % 5).map((s) => s.id)).toEqual([]);
  });

  it('au niveau 2, les Talents offerts comprennent ceux du niveau 1 (CRB 045 l.58)', () => {
    const { h } = recrue5e(0);
    const cle = (t: { ref: { id: string; spec?: string } }) => `${t.ref.id}:${t.ref.spec ?? ''}`;
    const niveau1 = progression(h.c).talents.map(cle);
    expect(niveau1.length).toBeGreaterThan(0);
    expect(progression(porterAuNiveau(h.c, 2, 11)).talents.map(cle)).toEqual(expect.arrayContaining(niveau1));
  });
});
