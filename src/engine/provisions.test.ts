import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { itemFromTrappingById } from './items';
import { Characteristics, Combatant, ItemInstance, type UpkeepDeferTest } from './types';
import { makeRNG, RNG } from './dice';
import {
  dailyFoodUpkeep,
  rationsDuSac,
  rationsDeLaCale,
  applyFaimTest,
  isStarving,
  hungerCharPenalties,
  rationCount,
  isRation,
  dailyWaterUpkeep,
  applySoifTest,
  isThirsty,
  isDeprived,
  thirstCharPenalties,
  feedFromMeal,
  mangerLaCale,
} from './provisions';
import type { Id } from '../data/schemas/grammaire/ref';
import { lotsDeCale } from './caleDeTest.testkit';
import { effectiveChar } from './characteristics';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';
import { RULE_REF } from './ruleRefs';
import { restRecovery, needsRecoveryRoll } from './rest';
import { addCondition, stacks } from './conditions';
import { deSelonLaPlage } from './dice.testkit';

const chars = (E = 30): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

const ration = (uid: string): ItemInstance => ({ ...itemFromTrappingById('ration', idsDeTest)!, uid, enc: 0 });

function hero(opts: { endurance?: number; rations?: number; brouet?: boolean; traits?: { id: string }[] } = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'h', label: 'Gunnar', kind: 'heros',
    characteristics: chars(opts.endurance),
    wounds: blessuresDeBase(12), advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: Array.from({ length: opts.rations ?? 0 }, (_, i) => ration(`r${i}`)),
    skills: [], talents: opts.brouet ? [{ talentId: 'brouet', times: 1 }] : [], movement: 4,
    ...(opts.traits ? { traits: opts.traits } : {}),
  });
}

/** RNG forcé : d100 → toujours `roll` (échec/réussite déterministe), d10 → 10. */
const fixed = (roll: number): RNG => deSelonLaPlage((_min, max) => (max === 100 ? roll : max));

describe('dailyFoodUpkeep — rations (LDB 66 l.20) et faim (LDB 18 l.342)', () => {
  it('la ration du catalogue porte le libellé du livre (LDB 66 l.20)', () => {
    expect(ration('r').label).toBe('Vivres, 1 jour');
  });

  it('consomme 1 ration/jour ; nourri = pas de faim', () => {
    const c = hero({ rations: 2 });
    const r = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(true);
    expect(rationCount(c)).toBe(1);
    expect(isStarving(c)).toBe(false);
  });

  it('#513 — ogre (ADE II 2 l.755) : consomme 2 rations/jour, insuffisant si une seule dispo', () => {
    const c = hero({ rations: 2, traits: [{ id: 'ogre' }] });
    const r = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(rationCount(c)).toBe(0); // les 2 rations consommées d'un coup
    const c2 = hero({ rations: 1, traits: [{ id: 'ogre' }] });
    const r2 = dailyFoodUpkeep(c2, rationsDuSac(c2), 30, 3, fixed(95));
    expect(r2.ate).toBe(false); // 1 ration ne suffit pas à un ogre (facteur ×2)
    expect(rationCount(c2)).toBe(1); // rien consommé faute du compte
  });

  it('Graisse de la terre (noHunger) : exempte de la Faim — aucune ration consommée, faim purgée', () => {
    const c = hero({ rations: 0 });
    c.hunger = { days: 3, tests: 2, failures: 1 }; // affamé avant le Sort
    c.activeEffects = [{ label: 'Graisse de la terre', bonus: 0, duration: { scale: 'permanent' }, noHunger: true }];
    const r = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(false); // rien à consommer (sustentation magique)
    expect(r.damage).toBe(0);
    expect(isStarving(c)).toBe(false); // compteurs de faim purgés
  });

  it('sans nourriture : Test de Résistance tous les 2 jours seulement', () => {
    const c = hero({ rations: 0 });
    const d1 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    expect(d1.log).toEqual([]); // jour 1 : pas encore de Test
    expect(isStarving(c)).toBe(true);
    const d2 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    expect(d2.log.map((x) => x.texte).join(' ')).toContain('Test de Résistance');
  });

  it('1ᵉʳ échec → −10 F et E (effectiveChar) ; 2ᵉ échec → dégâts ignorant les PA (min 1) + −10 ailleurs', () => {
    const c = hero({ rations: 0, endurance: 30 });
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // j1
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // j2 : Test raté → 1ᵉʳ échec
    expect(c.hunger?.failures).toBe(1);
    expect(effectiveChar(c, 'force')).toBe(20);
    expect(effectiveChar(c, 'endurance')).toBe(20);
    expect(effectiveChar(c, 'agilite')).toBe(30); // pas encore
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // j3
    const d4 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // j4 : 2ᵉ échec
    expect(c.hunger?.failures).toBe(2);
    expect(d4.damage).toBe(7); // d10 forcé à 10 − BE 3 = 7
    expect(effectiveChar(c, 'agilite')).toBe(20);
    expect(hungerCharPenalties(c, 'intelligence')).toEqual([-10]);
  });

  it('les Tests sont de plus en plus difficiles : −10 par Test déjà tenté (LDB 18 l.338)', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    const d2 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // 1ᵉʳ Test : cible 30
    expect(d2.log[0].texte).toContain('30');
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    const d4 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // 2ᵉ Test : cible 30 − 10 = 20
    expect(d4.log[0].texte).toContain('(−10)');
    expect(d4.log[0].texte).toContain('20');
  });

  it('manger à nouveau efface compteurs et malus (choix documenté)', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95));
    expect(effectiveChar(c, 'force')).toBe(20);
    c.items!.push(ration('r9'));
    const r = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.log.map((x) => x.texte).join(' ')).toContain('mange enfin à sa faim');
    expect(isStarving(c)).toBe(false);
    expect(effectiveChar(c, 'force')).toBe(30);
  });

  it('Brouet (LDB 10 l.139) : 1 ration couvre 2 jours, Test de faim tous les 3 jours', () => {
    const c = hero({ rations: 1, brouet: true });
    const d1 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(d1.rationConsumed).toBe(true);
    const d2 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1)); // jour « gratuit »
    expect(d2.ate).toBe(true);
    expect(d2.rationConsumed).toBe(false);
    // Puis plus rien : Test au 3ᵉ jour de jeûne (pas au 2ᵉ).
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // jeûne j1
    const j2 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // jeûne j2 : pas de Test
    expect(j2.log).toEqual([]);
    const j3 = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // jeûne j3 : Test
    expect(j3.log.map((x) => x.texte).join(' ')).toContain('Test de Résistance');
  });

  it('isRation : capacité intrinsèque par-OBJET `isRations`, indépendante du libellé', () => {
    expect(isRation(ration('r'))).toBe(true);
    // Objet non-ration (autre trapping) et objet custom (sans trappingId) → false.
    expect(isRation({ ...itemFromTrappingById('grimoire', idsDeTest)!, uid: 'g', enc: 1 })).toBe(false);
    expect(isRation({ uid: 'x', label: 'Caillou', kind: 'misc', qualities: [], enc: 0, equipped: false })).toBe(false);
  });

  it('deferTest (cascade de nuit) : un Test de Faim DÛ est DIFFÉRÉ, pas roulé ici', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95)); // jeûne j1 (pas de Test)
    let kind = '';
    let mods: Parameters<UpkeepDeferTest>[0]['mods'];
    const r = dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(95), (spec) => { kind = spec.kind; mods = spec.mods; }); // j2 : Test DÛ → différé
    expect(kind).toBe('faim');
    // La pénalité voyage NOMMÉE avec sa règle depuis le producteur (jamais étiquetée à la couture d'entretien).
    expect(mods).toEqual([{ value: 0, label: 'Tests déjà subis', famille: 'jet', ref: RULE_REF['faim-et-soif'] }]); // 1ᵉʳ Test → pénalité 0
    expect(r.log).toEqual([]); // RIEN de pré-résolu (pas de « ÉCHEC » dans le journal)
    expect(c.hunger?.tests).toBe(0); // le compteur de Test reste à 0 ici (incrémenté seulement à la validation)
    expect(c.hunger?.days).toBe(2); // la faim a bien progressé d'un jour
  });

  it('applyFaimTest : verrouiller un échec compte le Test + applique les pénalités (LDB 18 l.342)', () => {
    const c = hero({ rations: 0, endurance: 30 });
    c.hunger = { days: 2, tests: 0, failures: 0 };
    const r1 = applyFaimTest(c, false, 3, fixed(95)); // 1ᵉʳ échec → −10 F/E
    expect(c.hunger?.tests).toBe(1);
    expect(c.hunger?.failures).toBe(1);
    expect(r1.damage).toBe(0);
    expect(effectiveChar(c, 'force')).toBe(20);
    const r2 = applyFaimTest(c, false, 3, fixed(95)); // 2ᵉ échec → −10 autres + 1d10 − BE
    expect(c.hunger?.failures).toBe(2);
    expect(r2.damage).toBe(7); // d10 forcé 10 − BE 3
    // Réussite : compte le Test, aucune pénalité.
    const r3 = applyFaimTest(c, true, 3, fixed(1));
    expect(c.hunger?.tests).toBe(3);
    expect(r3.damage).toBe(0);
  });
});

describe('Faim & repos (LDB 18 l.338) : pas de récupération naturelle sans provisions', () => {
  it('affamé : le repos ne rend ni PB ni Exténué (les maladies suivent leur cours)', () => {
    const c = hero({ rations: 0 });
    c.hunger = { days: 2, tests: 1, failures: 0 };
    c.wounds.current = 5;
    addCondition(c, 'extenue', 2);
    const log = restRecovery(c, makeRNG(1));
    expect(c.wounds.current).toBe(5);
    expect(stacks(c, 'extenue')).toBe(2);
    expect(log.map((e) => e.texte).join(' ')).toContain('affamé');
  });

  it('nourri : le repos fonctionne normalement', () => {
    const c = hero({ rations: 1 });
    c.wounds.current = 5;
    addCondition(c, 'extenue', 2);
    restRecovery(c, makeRNG(1));
    expect(c.wounds.current).toBeGreaterThan(5);
    expect(stacks(c, 'extenue')).toBe(0);
  });
});

describe('dailyWaterUpkeep — Soif / privation d’eau (LDB 18 l.340)', () => {
  it('avec eau : boit, pas de soif ; la soif installée se dissipe', () => {
    const c = hero();
    c.thirst = { days: 3, tests: 2, failures: 1 };
    const w = dailyWaterUpkeep(c, true, 30, 3, fixed(1));
    expect(w.drank).toBe(true);
    expect(isThirsty(c)).toBe(false);
    expect(w.log.map((x) => x.texte).join(' ')).toContain('se désaltère');
  });

  it('sans eau : Test QUOTIDIEN (1ᵉʳ échec → −10 Int/FM/Soc, pas de dégâts)', () => {
    const c = hero();
    const w = dailyWaterUpkeep(c, false, 30, 3, fixed(95)); // jour 1 : Test raté → 1ᵉʳ échec
    expect(c.thirst?.days).toBe(1);
    expect(c.thirst?.failures).toBe(1);
    expect(w.damage).toBe(0);
    expect(effectiveChar(c, 'intelligence')).toBe(20);
    expect(effectiveChar(c, 'force-mentale')).toBe(20);
    expect(effectiveChar(c, 'sociabilite')).toBe(20);
    expect(effectiveChar(c, 'force')).toBe(30); // F reste intacte au 1ᵉʳ échec
  });

  it('2ᵉ échec : −10 aux autres Caractéristiques + 1d10 − BE (min 1) Dégâts', () => {
    const c = hero({ endurance: 30 });
    dailyWaterUpkeep(c, false, 30, 3, fixed(95)); // j1 : 1ᵉʳ échec
    const w2 = dailyWaterUpkeep(c, false, 30, 3, fixed(95)); // j2 : Test plus dur, 2ᵉ échec
    expect(c.thirst?.failures).toBe(2);
    expect(w2.damage).toBe(7); // d10 forcé 10 − BE 3
    expect(effectiveChar(c, 'force')).toBe(20); // « toutes les autres » désormais touchées
    expect(thirstCharPenalties(c, 'capacite-de-combat')).toEqual([-10]);
  });

  it('Tests de plus en plus durs (−10 cumulatif, LDB 18 l.338)', () => {
    const c = hero();
    const w1 = dailyWaterUpkeep(c, false, 30, 3, fixed(1)); // j1 réussi
    expect(w1.log.map((x) => x.texte).join(' ')).not.toContain('−'); // 1ᵉʳ Test : pas de malus
    const w2 = dailyWaterUpkeep(c, false, 30, 3, fixed(1)); // j2
    expect(w2.log.map((x) => x.texte).join(' ')).toContain('(−10)'); // 2ᵉ Test : −10
  });

  it('deferTest : le Test devient une étape de cascade (rien de roulé ici)', () => {
    const c = hero();
    const seen: { kind: string }[] = [];
    const w = dailyWaterUpkeep(c, false, 30, 3, fixed(95), (spec) => seen.push(spec));
    expect(seen[0]?.kind).toBe('soif');
    expect(c.thirst?.days).toBe(1);
    expect(c.thirst?.tests).toBe(0); // compteur à 0 ici (incrément différé)
    expect(w.log).toEqual([]);
  });

  it('applySoifTest : applique le résultat différé', () => {
    const c = hero({ endurance: 30 });
    const r1 = applySoifTest(c, false, 3, fixed(95)); // 1ᵉʳ échec
    expect(c.thirst?.failures).toBe(1);
    expect(r1.damage).toBe(0);
    const r2 = applySoifTest(c, false, 3, fixed(95)); // 2ᵉ échec → dégâts
    expect(r2.damage).toBe(7);
  });

  it('isDeprived : affamé OU assoiffé bloque la récupération ; assoiffé seul suffit', () => {
    const c = hero({ rations: 1 }); // pas affamé
    c.thirst = { days: 2, tests: 1, failures: 0 };
    expect(isStarving(c)).toBe(false);
    expect(isThirsty(c)).toBe(true);
    expect(isDeprived(c)).toBe(true);
    expect(needsRecoveryRoll(blessuresSurLeProfil({ ...c, wounds: blessuresDeBase(12, 5) }) as typeof c)).toBe(false);
  });
});

/** Régime de bord : manger l'écrit, pour le PJ (`dailyFoodUpkeep`) comme pour l'équipage (`mangerLaCale`). MDG 14 l.230-232 ; #4243 */
describe('régime de bord — écrit en mangeant (MDG 14 l.230-232)', () => {
  const SOUPE = 'ration-soupe-chou-fermente' as Id<'trapping'>, FRAIS = 'nourriture-courses-journee' as Id<'trapping'>;
  const BISCUITS = 'ration-biscuits-de-mer' as Id<'trapping'>;
  const soupe = (uid: string): ItemInstance => ({ ...itemFromTrappingById(SOUPE, idsDeTest)!, uid });

  it('une ration ordinaire : un jour de plus sans frais ; une ration de soupe : et un jour de soupe', () => {
    const c = hero({ rations: 1 });
    c.items = [...c.items!, soupe('s1')];
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(c.regimeDeBord).toEqual({ joursSansVivreFrais: 1, joursDeSoupe: 0 });
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(c.regimeDeBord).toEqual({ joursSansVivreFrais: 2, joursDeSoupe: 1 });
  });

  it('porter de la soupe sans la manger ne compte pas : seul le vivre mangé fait le jour', () => {
    const c = hero({ rations: 1 });
    c.items = [...c.items!, soupe('s1')];
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(c.items!.map((it) => it.trappingId)).toEqual([SOUPE]);
    expect(c.regimeDeBord!.joursDeSoupe).toBe(0);
  });

  it('un repas pris (auberge) est un vivre frais : le mois repart à zéro, soupe comprise', () => {
    const c = hero({ rations: 0 });
    c.regimeDeBord = { joursSansVivreFrais: 12, joursDeSoupe: 7 };
    feedFromMeal(c);
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(c.regimeDeBord).toEqual({ joursSansVivreFrais: 0, joursDeSoupe: 0 });
  });

  it('Brouet (LDB 10 l.139) : le jour couvert par la demi-ration est fait du même vivre, jamais du frais', () => {
    const c = hero({ rations: 0, brouet: true });
    c.items = [soupe('s1')];
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, makeRNG(1));
    expect(c.regimeDeBord).toEqual({ joursSansVivreFrais: 2, joursDeSoupe: 2 });
  });

  it('un jour sans manger : un jour de plus sans frais', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, rationsDuSac(c), 30, 3, fixed(1));
    expect(c.regimeDeBord).toEqual({ joursSansVivreFrais: 1, joursDeSoupe: 0 });
  });

  it('la cale comme garde-manger : prend le besoin entier et laisse le sac, ou rien quand elle est à court (MDG 14 l.238 ; #4453)', () => {
    const ogre = hero({ rations: 2, traits: [{ id: 'ogre' }] });
    const cale = { lots: lotsDeCale({ [FRAIS]: 3 }, 0) };
    const r = dailyFoodUpkeep(ogre, rationsDeLaCale(cale, 0), 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(rationCount(ogre)).toBe(2);
    expect(cale.lots.map((l) => l.rations)).toEqual([1]);
    expect(ogre.regimeDeBord).toEqual({ joursSansVivreFrais: 0, joursDeSoupe: 0 });
    const r2 = dailyFoodUpkeep(ogre, rationsDeLaCale(cale, 0), 30, 3, makeRNG(1));
    expect(r2.ate).toBe(false);
    expect(cale.lots.map((l) => l.rations)).toEqual([1]);
    expect(rationCount(ogre)).toBe(2);
  });

  it('mangerLaCale rend le repas de chaque jour : le vivre qui a nourri seul toutes les bouches, absent si mêlé ou à court', () => {
    const cale = lotsDeCale({ [FRAIS]: 4, [SOUPE]: 5, [BISCUITS]: 2 }, 0);
    expect(mangerLaCale(cale, 3, 4, 0).repas).toEqual([FRAIS, undefined, SOUPE, undefined]);
  });
});
