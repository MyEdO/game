import { describe, it, expect } from 'vitest';
import type { Combatant, UpkeepDeferTest } from './types';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import type { RNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { contractDisease, contractDiseaseOnce, tickDisease, aggravateDiseaseSymptom, diseaseDefs } from './disease';
import { dailyDiseaseUpkeep } from './rest';
import { applyOps } from './ops';
import { syncDerivedConditions } from './conditions';
import { spellOps } from './flowCore';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { desDuTest, desEnSuite } from './dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/** La porte, quand le Test différé n'est pas le sujet du test. */const ignore: UpkeepDeferTest = () => {};

/** RNG scripté : renvoie les valeurs dans l'ordre. */
function seq(values: number[]): RNG {
  return desEnSuite(values);
}

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', label: 'Malade', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    diseases: [],
    ...p,
  } as Combatant);

const symptomIds = (c: Combatant) => c.diseases![0].symptoms.map((s) => s.symptomId).sort();
const fievre = (c: Combatant) => c.diseases!.find((d) => d.id === 'pneumonie')!.symptoms.find((s) => s.symptomId === 'fievre')!;

describe('Rhume commun → Pneumonie : la mue à 14 jours (EDOC 08 l.122)', () => {
  it('14 jours de symptômes : le rhume tient encore ; le 15ᵉ : il se transforme en pneumonie', () => {
    const c = hero({ diseases: [contractDisease('rhume-commun', seq([]), { incubation: 0, duration: 40 })!] });
    // Le rhume ne porte aucun Test de cycle (Toux et éternuements / Malaise n'ont pas d'`onTick`) : rien n'est tiré.
    tickDisease(c, 14 * MINUTES_PER_DAY, seq([]), ignore);
    expect(c.diseases!.map((d) => d.id)).toEqual(['rhume-commun']);
    expect(c.diseases![0].activeDaysElapsed).toBe(14);

    // 15ᵉ jour : la durée de la PNEUMONIE contractée est 3d10 → 4+4+4 = 12 jours.
    const log = tickDisease(c, MINUTES_PER_DAY, seq([4, 4, 4]), ignore);
    expect(c.diseases!.map((d) => d.id)).toEqual(['pneumonie']);
    expect(log.some((l) => /se transforme en/.test(l))).toBe(true);
  });

  it('la pneumonie née de la mue démarre ACTIVE avec ses symptômes RAW (l.100-102)', () => {
    const c = hero({ diseases: [contractDisease('rhume-commun', seq([]), { incubation: 0, duration: 40 })!] });
    tickDisease(c, 15 * MINUTES_PER_DAY, seq([4, 4, 4]), ignore);
    const pn = c.diseases![0];
    expect(pn.phase).toBe('active');
    expect(pn.minutesLeft).toBe(12 * MINUTES_PER_DAY);
    expect(pn.symptoms.map((s) => s.symptomId).sort()).toEqual(['fievre', 'malaise', 'touxEternuements']);
  });

  it('la mue est portée par la DONNÉE (aucun id de maladie codé dans le moteur)', () => {
    expect(diseaseDefs()['rhume-commun'].mutation).toEqual({ afterDays: 14, into: 'pneumonie' });
  });
});

describe('Pneumonie : le Test de Résistance quotidien (EDOC 08 l.104-108)', () => {
  it('échec → le symptôme Fièvre devient Grave ; nouvel échec (Fièvre Grave en vigueur) → symptôme Toxine', () => {
    // incubation « Instantanée » (l.100) → phase active d'emblée ; durée 3d10 → 5+5+5 = 15 jours.
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    expect(c.diseases![0].phase).toBe('active');

    // Le Test part à la porte ; l'issue est INJECTÉE (échec), la conséquence passe par l'applier.
    const jour = (success: boolean) => {
      const { specs, defer } = porteEntretien();
      tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
      for (const s of specs) applique(c, s, { success }, desDuTest);
    };
    jour(false);
    expect(fievre(c).severity).toBe('grave');
    expect(symptomIds(c)).toEqual(['fievre', 'malaise', 'touxEternuements']); // pas encore de Toxine

    jour(false);
    expect(symptomIds(c)).toEqual(['fievre', 'malaise', 'touxEternuements', 'toxine']);
  });

  it('réussite → rien ne s’aggrave (la Fièvre reste au palier de base)', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    for (const s of specs) applique(c, s, { success: true }, desDuTest); // issue INJECTÉE : réussite
    expect(fievre(c).severity).toBeUndefined();
    expect(symptomIds(c)).toEqual(['fievre', 'malaise', 'touxEternuements']);
  });

  it('l’aggravation ne touche QUE l’instance portée (le catalogue partagé reste intact)', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    for (const s of specs) applique(c, s, { success: false }, desDuTest);
    expect(fievre(c).severity).toBe('grave');
    expect(diseaseDefs()['pneumonie'].symptoms.find((s) => s.symptomId === 'fievre')!.severity).toBeUndefined();
  });
});

describe('Pneumonie : le Test quotidien passe par le canal INFLUENÇABLE de l’entretien', () => {
  it('tickDisease(defer) : le Test est DIFFÉRÉ en étape `diseaseTick` et n’est PAS roulé', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    const { specs, defer } = porteEntretien();
    // seq([]) : un seul jet tiré renverrait `undefined` — le moteur ne DOIT rien rouler.
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    expect(specs.map((s) => s.kind)).toEqual(['diseaseTick']);
    expect(specs[0].difficulty).toBe('intermediaire');
    expect(specs[0].test, 'EDOC 08 l.104 — « Test de Résistance Intermédiaire (+0) »').toEqual({ skill: 'resistance' });
    expect(specs[0].base, 'aucune valeur maison : la porte la calcule').toBeUndefined();
    expect(specs[0].meta?.diseaseName).toBe('pneumonie');
    expect(specs[0].meta?.symptomId, 'l’étape NOMME le symptôme mis en jeu').toBe('fievre');
    expect(fievre(c).severity, 'rien n’est pré-résolu').toBeUndefined();
  });

  it('dailyDiseaseUpkeep(defer) : la même étape remonte depuis l’entretien quotidien', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    const { specs, defer } = porteEntretien();
    dailyDiseaseUpkeep(c, seq([]), defer);
    expect(specs.map((s) => s.kind)).toEqual(['diseaseTick']);
  });

  it('l’applicateur de l’étape (applyOps sur `onFail`) produit la MÊME échelle d’aggravation', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    const onFail = spellOps(diseaseDefs()['pneumonie'].dailyTest!.test.fail, 'target');
    applyOps(c, onFail, { idNeuf: idNeufDeBanc, rng: seq([]) });
    expect(fievre(c).severity).toBe('grave');
    applyOps(c, onFail, { idNeuf: idNeufDeBanc, rng: seq([]) });
    expect(symptomIds(c)).toContain('toxine');
  });
});

describe('`aggravateSymptom` : TROIS issues distinctes, jamais un booléen (EDOC 08 l.104-108)', () => {
  const onFail = () => spellOps(diseaseDefs()['pneumonie'].dailyTest!.test.fail, 'target');

  it('symptôme présent, PAS encore à cette sévérité → `aggrave` (et rien de l’échelon suivant)', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    expect(aggravateDiseaseSymptom(c, 'pneumonie', 'fievre', 'grave').etat).toBe('aggrave');
    expect(symptomIds(c)).not.toContain('toxine');
  });

  it('symptôme DÉJÀ à cette sévérité → `deja` : c’est CE cas, et lui seul, qui ouvre l’échelon suivant', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    applyOps(c, onFail(), { idNeuf: idNeufDeBanc, rng: seq([]) }); // Fièvre → Grave
    expect(aggravateDiseaseSymptom(c, 'pneumonie', 'fievre', 'grave').etat).toBe('deja');
    applyOps(c, onFail(), { idNeuf: idNeufDeBanc, rng: seq([]) });
    expect(symptomIds(c)).toContain('toxine');
  });

  it('symptôme ABSENT → `absent` : l’échelon `otherwise` ne s’ouvre PAS (le Toxine ne tombe pas)', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    const dz = c.diseases![0];
    dz.symptoms = dz.symptoms.filter((s) => s.symptomId !== 'fievre'); // aucune Fièvre portée
    expect(aggravateDiseaseSymptom(c, 'pneumonie', 'fievre', 'grave').etat).toBe('absent');
    // L'État *Exténué* que le Malaise PORTE (LDB 20 l.188) est posé d'avance : il n'appartient pas à
    // la chaîne d'aggravation, et ce test-ci ne juge QU'elle.
    syncDerivedConditions(c);
    const log = applyOps(c, onFail(), { idNeuf: idNeufDeBanc, rng: seq([]) });
    expect(symptomIds(c), 'sans Fièvre, la chaîne ne descend pas jusqu’à Toxine').not.toContain('toxine');
    expect(log, 'rien à journaliser non plus').toEqual([]);
  });

  it('maladie non portée → `absent` (même verdict, même silence)', () => {
    const c = hero({ diseases: [] });
    expect(aggravateDiseaseSymptom(c, 'pneumonie', 'fievre', 'grave').etat).toBe('absent');
  });
});

describe('FK des ops de symptôme : une coquille est REFUSÉE AU PARSE (#674 M1)', () => {
  const op = (patch: Record<string, unknown>) =>
    gameOpSchema.safeParse({ op: 'aggravateSymptom', disease: 'pneumonie', symptomId: 'fievre', severity: 'grave', ...patch });

  it('la forme JUSTE passe', () => {
    expect(op({}).success).toBe(true);
  });

  it('`symptomId` coquillé → refusé (la chaîne ne peut plus tomber en silence sur l’échelon suivant)', () => {
    expect(op({ symptomId: 'fievr' }).success).toBe(false);
  });

  it('`disease` coquillé → refusé', () => {
    expect(op({ disease: 'pneumoni' }).success).toBe(false);
  });

  it('`grantSymptom` porte les MÊMES deux clés étrangères', () => {
    expect(gameOpSchema.safeParse({ op: 'grantSymptom', disease: 'pneumonie', symptomId: 'toxine' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'grantSymptom', disease: 'pneumonie', symptomId: 'toxin' }).success).toBe(false);
    expect(gameOpSchema.safeParse({ op: 'grantSymptom', disease: 'pneumoni', symptomId: 'toxine' }).success).toBe(false);
  });
});

describe('MUE vers une maladie DÉJÀ portée : le journal ne ment pas (#674 R2)', () => {
  it('pneumonie déjà contractée → aucune ligne « se transforme en », et le rhume cède quand même la place', () => {
    const c = hero({
      diseases: [
        contractDisease('rhume-commun', seq([]), { incubation: 0, duration: 40 })!,
        contractDisease('pneumonie', seq([]), { duration: 60 })!,
      ],
    });
    // Aucun jet n'est roulé par le moteur (ils partent à la porte) : seule la MUE du 15ᵉ jour bouge la liste.
    const log = tickDisease(c, 15 * MINUTES_PER_DAY, seq([]), ignore);
    expect(c.diseases!.map((d) => d.id), 'le rhume disparaît (la mue a bien eu lieu)').toEqual(['pneumonie']);
    expect(log.some((l) => /se transforme en/.test(l)), 'aucune 2ᵉ pneumonie n’a été contractée').toBe(false);
    expect(log.some((l) => /cède la place/.test(l)), 'la mue est journalisée pour ce qu’elle est').toBe(true);
  });
});

describe('RÉ-EXPOSITION : la prolongation est portée par la DONNÉE (`reExposition`, EDOC 08 l.122)', () => {
  it('porteur d’une maladie qui porte `reExposition` → durée prolongée du temps authoré + ligne rendue', () => {
    const dz = contractDisease('rhume-commun', seq([]), { incubation: 0, duration: 5 })!;
    dz.phase = 'active';
    dz.minutesLeft = dz.durationMinutes;
    const c = hero({ diseases: [dz] });
    const log = contractDiseaseOnce(c, 'rhume-commun', seq([7])); // 1d10 → 7 jours
    expect(c.diseases!.length, 'aucune 2ᵉ instance contractée').toBe(1);
    expect(dz.durationMinutes).toBe((5 + 7) * MINUTES_PER_DAY);
    expect(dz.minutesLeft).toBe((5 + 7) * MINUTES_PER_DAY);
    expect(log.some((l) => /de nouveau exposé, « Rhume commun » traîne 7 jour/.test(l))).toBe(true);
  });

  it('porteur d’une maladie SANS `reExposition` → rien (aucune prolongation inventée)', () => {
    expect(diseaseDefs()['pneumonie'].reExposition, 'la pneumonie n’en porte pas').toBeUndefined();
    const dz = contractDisease('pneumonie', seq([]), { incubation: 0, duration: 5 })!;
    const c = hero({ diseases: [dz] });
    expect(contractDiseaseOnce(c, 'pneumonie', seq([7]))).toEqual([]);
    expect(dz.durationMinutes).toBe(5 * MINUTES_PER_DAY);
  });

  it('`contraction: false` : un héros SAIN ne contracte rien, la ré-exposition d’un porteur agit quand même', () => {
    const sain = hero({ diseases: [] });
    expect(contractDiseaseOnce(sain, 'rhume-commun', seq([7]), { contraction: false })).toEqual([]);
    expect(sain.diseases!.length).toBe(0);
    const dz = contractDisease('rhume-commun', seq([]), { incubation: 0, duration: 5 })!;
    const porteur = hero({ diseases: [dz] });
    expect(contractDiseaseOnce(porteur, 'rhume-commun', seq([3]), { contraction: false }).length).toBe(1);
    expect(dz.durationMinutes).toBe((5 + 3) * MINUTES_PER_DAY);
  });
});
