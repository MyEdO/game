import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ameliorer,
  charger,
  ESPECES,
  nouvellePartie,
  planVersLeNiveau,
  recrue,
  renouvelerLesCandidats,
  suivreLePlan,
  PROFILS,
  type Heros,
  type Profil,
} from './index';
import { makeRNG, planDuNiveau, porterAuNiveau, poserLesReglesDuRoguelite, progression, tirerUneEspece } from '../noyau';
import { prixDuPlanAuNoyau } from './recrue5e.testkit';
import { brouillonDeLaPartie, findSpeciesById, names } from '../../../../src/noyau';
import { especesOffertes } from '../../../../src/noyau/creation/brouillon';
import { modeleDe } from '../../../../src/engine/modeleDeProgression';
import { casesDuNiveau } from '../../../../src/engine/casesDeCarriere';
import type { Combatant } from '../../../../src/engine/types';
/** Une sauvegarde de `nouvellePartie(5)` au code 2db8e5bd9b, d'avant la création 5e, ses candidats retirés. */
import sauvegarde4e from './sauvegarde-4e.json?raw';

beforeAll(() => poserLesReglesDuRoguelite());

/** Les espèces que `tirerUneEspece` donne à la carrière de `p`, sur 300 tirages. */
const especesDe = (p: Profil) => [...new Set(Array.from({ length: 300 }, (_, i) => tirerUneEspece(makeRNG(i), p.id, Object.keys(ESPECES))))];

/** Les recrues de `p` que le relais d'une partie tire jusqu'à en avoir une de chaque espèce de `especesDe(p)`. */
function recruesDe(p: Profil): Heros[] {
  const voulues = especesDe(p);
  const e = nouvellePartie(p.id.length * 97);
  const parEspece = new Map<string, Heros>();
  for (let n = 0; n < 1000 && parEspece.size < voulues.length; n++) {
    const h = recrue(e, p);
    if (!parEspece.has(h.espece)) parEspece.set(h.espece, h);
  }
  expect([...parEspece.keys()].sort(), p.id).toEqual([...voulues].sort());
  return [...parEspece.values()];
}

/** Les points de chaque Caractéristique et Compétence de `c` hors d'un multiple de 5. CRB 014 l.21 ; CRB 015 l.7 */
const horsDuPas = (c: Combatant): string[] => [
  ...Object.entries(c.charAdvances ?? {}).filter(([, n]) => (n ?? 0) % 5).map(([k, n]) => `${k} = ${n}`),
  ...c.skills.filter((s) => s.advances % 5).map((s) => `${s.id}:${s.spec ?? ''} = ${s.advances}`),
];

describe('recrues : la création 5e du noyau', () => {
  it('la compagnie de départ de `nouvellePartie` naît en 5e, sa première recrue comprise', () => {
    const e = nouvellePartie(3);
    expect(e.roster.map((h) => h.c.progression)).toEqual(['5e', '5e', '5e', '5e']);
    expect(e.candidats.every((h) => h.c.progression === '5e')).toBe(true);
  });

  it('les espèces du roguelite sont offertes au brouillon 5e (`especesOffertes`). CRB 006 l.5', () => {
    const offertes = especesOffertes(brouillonDeLaPartie(1, 0)).map((s) => s.id);
    expect(offertes).toEqual(expect.arrayContaining(Object.keys(ESPECES)));
  });

  it('l’espèce d’une recrue se tire au poids de la table des espèces du CRB, parmi celles dont la colonne offre sa carrière. CRB 006 l.11-17 ; CRB 013 l.23-103', () => {
    const tirage = (carriere: string) => {
      const compte: Record<string, number> = {};
      for (let face = 1, fin = false; !fin; face++) {
        const rng = { int: (min: number, max: number) => { fin = face >= max; return Math.min(face, max) + min - 1; } };
        const e = tirerUneEspece(rng, carriere, Object.keys(ESPECES));
        compte[e] = (compte[e] ?? 0) + 1;
      }
      return compte;
    };
    expect(tirage('soldat')).toEqual({ 'humains-reiklander': 90, halflings: 4, nains: 4 });
    expect(tirage('duelliste')).toEqual({ 'humains-reiklander': 90, nains: 4 });
    expect(tirage('tueur')).toEqual({ nains: 4 });
    expect(tirage('nonne')).toEqual({ 'humains-reiklander': 90 });
  });

  it('PROFILS × espèces : la recrue au niveau du profil, en 5e, ses seuils de cases atteints sans dépassement, ses points sur des multiples de 5, et son niveau suivant aux prix du noyau. CRB 048 l.45', () => {
    const ecarts: string[] = [];
    for (const p of PROFILS) {
      for (const h of recruesDe(p)) {
        const cle = `${p.id} × ${h.espece}`;
        const c = h.c;
        if (c.progression !== '5e') ecarts.push(`${cle} : progression ${c.progression}`);
        if (c.careerLevel !== p.niveau) ecarts.push(`${cle} : niveau ${c.careerLevel}`);
        const passage = modeleDe(c).passage;
        if (passage.type !== 'cases') { ecarts.push(`${cle} : passage ${passage.type}`); continue; }
        for (let n = 1; n < p.niveau; n++) {
          const cases = casesDuNiveau(c, p.id, n);
          if (cases !== passage.seuils[n - 1]) ecarts.push(`${cle} : ${cases} cases au niveau ${n} pour un seuil de ${passage.seuils[n - 1]}`);
        }
        ecarts.push(...horsDuPas(c).map((x) => `${cle} : ${x}`));
        const prog = progression(c);
        const plan = planDuNiveau(c, prog);
        const remises = new Map(prog.competences.map((k) => [`${k.ref.id}:${k.ref.spec ?? ''}`, k.remise]));
        const prix = plan.reduce((s, x) => s + x.cout, 0);
        const auNoyau = prixDuPlanAuNoyau(c, plan, remises);
        if (prix !== auNoyau) ecarts.push(`${cle} : plan à ${prix} PX, ${auNoyau} au noyau`);
        const porte = porterAuNiveau({ ...c, xp: 0 }, p.niveau + 1, 5);
        if (porte.careerLevel !== p.niveau + 1 || (porte.xp ?? 0) !== 0) ecarts.push(`${cle} : porté au niveau ${porte.careerLevel}, ${porte.xp} PX restants`);
        const cases = casesDuNiveau(porte, p.id, p.niveau);
        if (cases !== passage.seuils[p.niveau - 1]) ecarts.push(`${cle} : ${cases} cases au niveau ${p.niveau} pour un seuil de ${passage.seuils[p.niveau - 1]}`);
        ecarts.push(...horsDuPas(porte).map((x) => `${cle} porté : ${x}`));
      }
    }
    expect(ecarts).toEqual([]);
  }, 60_000);

  it('le nom d’une recrue se tire au sexe tiré de la recrue : son prénom, et le suffixe de son patronyme nain, dans la banque de son sexe. LDB 05 l.621-633', () => {
    const ecarts: string[] = [];
    const sexes = new Set<string>();
    for (const p of PROFILS) {
      for (const h of recruesDe(p)) {
        const sexe = h.c.appearance?.sex;
        const banque = names.find((n) => n.id === findSpeciesById(h.espece)?.refChar)!;
        const [prenom, ...reste] = h.c.label.split(' ');
        const prenoms = sexe === 'F' ? banque.femaleFirstNames : banque.maleFirstNames;
        const suffixes = banque.lastNameSuffixes?.[sexe!];
        if (!sexe) { ecarts.push(`${p.id} × ${h.espece} : sans sexe`); continue; }
        sexes.add(sexe);
        if (!prenoms.includes(prenom)) ecarts.push(`${p.id} × ${h.espece} (${sexe}) : prénom ${prenom}`);
        if (suffixes && !suffixes.some((s) => reste.join(' ').endsWith(s))) ecarts.push(`${p.id} × ${h.espece} (${sexe}) : patronyme ${reste.join(' ')}`);
      }
    }
    expect(ecarts).toEqual([]);
    expect([...sexes].sort()).toEqual(['F', 'M']);
  }, 60_000);
});

describe('sauvegarde : une compagnie 4e', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('une sauvegarde de la compagnie 4e (`sauvegarde-4e.json`) se charge, chaque héros passe au niveau 2 au prix de son plan, et le relais y tire des recrues 5e', () => {
    const memoire = new Map<string, string>([['grisefosse-v1', sauvegarde4e]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, removeItem: (k: string) => { memoire.delete(k); } });
    const e = charger()!;
    expect(e.roster.map((h) => h.carriere)).toEqual(['soldat', 'nonne', 'pyromancien', 'hierophante']);
    e.or = 10_000; e.trophees = 10;
    expect(ameliorer(e, 'salle')).toBeNull();
    for (const h of e.roster) {
      expect(h.c.progression ?? '4e', h.carriere).toBe('4e');
      expect(progression(h.c).exigence?.type, h.carriere).toBe('completion');
      h.c.xp = 5000;
      const plan = planVersLeNiveau(h);
      expect(plan.total, h.carriere).toBeGreaterThan(0);
      expect(suivreLePlan(e, h.c.id).refus, h.carriere).toBeNull();
      expect([h.c.careerLevel, h.c.xp], h.carriere).toEqual([2, 5000 - plan.total]);
    }
    renouvelerLesCandidats(e);
    expect(e.candidats.length).toBeGreaterThan(0);
    expect(e.candidats.every((x) => x.c.progression === '5e')).toBe(true);
  });
});
