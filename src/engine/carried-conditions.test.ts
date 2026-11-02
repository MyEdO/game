/**
 * États PORTÉS par l'effet actif de leur source — op `condition { carried: true }` (#1695).
 *
 * RAW (`Source/Warhammer v4 - Livre de base version corrigee/48 - Magie des Couleurs.md` l.495,
 * Transmutation de Chamon) : « le Sort ignore le Bonus d'Endurance et inflige +1 États *Aveuglé*,
 * *Assourdi* et *Sonné*, qui persistent tous pour la durée du Sort. »
 * LDB 16 l.11 : « les pénalités obtenues s'accumulent. »
 * LDB 16 l.117 : « Si vous dépensez un Point de Détermination pour vous débarrasser d'un État
 * *Inconscient*, mais que vous êtes toujours sujet aux causes de cette inconscience, vous gagnez un
 * nouvel État *Inconscient* à la fin du Round. »
 * LDB 17 l.61 : « Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure
 * lorsque vous vous mettez debout. » — UN État, jamais la source entière.
 *
 * CHEMIN RÉEL de bout en bout : le Sort du catalogue est lancé par `applyCast` (`noyau/combatFlow`,
 * l'appel même que la confirmation d'incantation fait, `combatFlow.ts:4980-4988`), la Surincantation de
 * Durée passe par ses pas (`overcast.duration` → `overcastDurationParts`), la Détermination par le
 * store (`spendResolveCondition`) et la fin de Round par ses hooks (`runCombatHooks('onRoundEnd')`,
 * `state/roundHooks`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../state/store';
import type { BattleState } from '../noyau/etat';
import { applyCast } from '../noyau/combatFlow';
import { runCombatHooks } from '../noyau/combatHooks';
import { effectSourcesOf } from '../noyau/triggeredEffects';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene } from '../noyau/monde/scene';
import { evaluateMissile, type CastResult } from './magic';
import { findSpellById } from '../data';
import { overcastDurationParts, overcastSourceOf } from './overcast';
import { stacks, derivedStacks, addCondition, removeCondition, syncDerivedConditions, fenetreDetermination } from './conditions';
import { dissipateSpell } from './dispel';
import { suspendSource } from './suspension';
import { passiveMods } from './trauma';
import { applyOps } from './ops';
import { gameOpSchema, CHAMPS_EXCLUS_DE_CARRIED } from '../data/schemas/grammaire/mecanique';
import { entree as spellEntreeSchema } from '../data/schemas/defs/spells';
import type { Combatant, ActiveEffect } from './types';
import { deFixe, desDuTest } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const CHAMON = 'transmutation-de-chamon';
const ETATS = ['aveugle', 'assourdi', 'sonne'] as const;
const SRC = { category: 'spells', id: CHAMON } as const;
/** BFM 3 (Force Mentale 35) : la Durée du Sort vaut 3 Rounds. */
const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: blessuresDeBase(40), advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, resolve: 3, engagedWith: [], size: 'moyenne', activeEffects: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant);

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const cr = (): CastResult => ({ cast: true, roll: 44, target: 60, sl: 0, isCritical: false, isFumble: false, log: '' });

/** La vue COURANTE d'un combattant dans le store (applyCast recompose la liste). */
const vue = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

/**
 * Lance Transmutation de Chamon sur `cible`, `steps` pas de Surincantation de DURÉE — MÊME appel que la
 * confirmation d'incantation (`combatFlow.ts:4980-4988` : `overcastDurationParts(overcastSourceOf(spell),
 * pc.overcast?.duration ?? 0)` → `durationMult`/`durationBonusRounds`).
 */
function lancerChamon(caster: Combatant, cible: Combatant, steps = 0): void {
  const spell = findSpellById(CHAMON)!;
  const ocDur = overcastDurationParts(overcastSourceOf(spell), steps);
  const res = evaluateMissile(caster, cible, spell, cr());
  applyCast(useGame.getState, useGame.setState, caster, cible, spell, res, true, false, undefined, {
    durationMult: ocDur.mult, durationBonusRounds: ocDur.bonusRounds, overcastDurationSteps: steps,
  });
}

/** Une fin de Round RÉELLE : les hooks de combat, dont `tick-durations` (order 15.5). Rend le journal
 *  que les hooks poussent à leur `sink` (c'est LUI que la boucle de combat déverse). */
function finDeRound(): string[] {
  const lignes: string[] = [];
  runCombatHooks('onRoundEnd', { get: useGame.getState, set: useGame.setState, battle: useGame.getState().battle!, sink: (l: string) => lignes.push(l) } as never);
  return lignes;
}

/** Les effets PORTEURS d'États d'un combattant (`ActiveEffect.passive` avec une op `condition`). */
const porteurs = (c: Combatant): ActiveEffect[] => (c.activeEffects ?? []).filter((e) => e.passive?.some((o) => o.op === 'condition'));

let mage: Combatant;
let cible: Combatant;

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null });
  mage = mk('enemy', 'mage', { pos: { x: 0, y: 0 } });
  cible = mk('hero', 'victime', { pos: { x: 2, y: 0 } });
  setBattle([mage, cible]);
});

describe('Transmutation de Chamon — 3 États PORTÉS par l’effet actif du Sort (LDB 48 l.495)', () => {
  it('pose 3 pions DÉRIVÉS du Sort, sans aucune durée propre sur le pion', () => {
    lancerChamon(mage, cible);
    const c = vue(cible.id);
    for (const id of ETATS) {
      expect(stacks(c, id), `l’État ${id} n’est pas posé`).toBe(1);
      expect(derivedStacks(c, id), `l’État ${id} n’est pas MARQUÉ comme dérivé`).toBe(1);
      expect(c.conditions.find((x) => x.id === id)!.derivedFrom!.src).toEqual(SRC);
      expect(c.conditions.find((x) => x.id === id)!.roundsLeft, `l’État ${id} porte une durée PROPRE`).toBeUndefined();
    }
    // UN effet porteur par op (3), chacun à la Durée du Sort (BFM 3 → 3 Rounds).
    expect(porteurs(c)).toHaveLength(3);
    for (const e of porteurs(c)) {
      expect(e.duration).toEqual({ scale: 'rounds', left: 3 });
      expect(e.spell!.spellId).toBe(CHAMON);
    }
    expect(useGame.getState().battle!.log.map((l) => l.text).join(' | ')).toContain('gagne l’État Aveuglé');
  });

  it('les trois tiennent Round après Round, puis partent TOUS le Round où le Sort expire', () => {
    lancerChamon(mage, cible);
    for (const tour of [1, 2]) {
      finDeRound();
      for (const id of ETATS) expect(stacks(vue(cible.id), id), `l’État ${id} est tombé au Round ${tour}`).toBe(1);
    }
    const lignes = finDeRound(); // 3ᵉ fin de Round : la Durée du Sort est écoulée
    const c = vue(cible.id);
    for (const id of ETATS) expect(stacks(c, id), `l’État ${id} a survécu à son Sort`).toBe(0);
    expect(porteurs(c)).toHaveLength(0);
    expect(lignes.join(' | '), 'les trois États sont tombés sans une ligne').toContain('perd l’État Sonné');
  });

  it('la DISSIPATION (LDB 46 l.158-162) emporte les trois États, avec leur ligne et leur notification', () => {
    lancerChamon(mage, cible);
    const log: string[] = [];
    const vus: { stateId: string; change: string }[] = [];
    expect(dissipateSpell([vue(cible.id)], CHAMON, mage.id, (e) => vus.push(e), log)).toBe(1);
    const c = vue(cible.id);
    for (const id of ETATS) expect(stacks(c, id), `l’État ${id} a survécu à la Dissipation`).toBe(0);
    expect(log.join(' | ')).toContain('perd l’État Assourdi');
    expect(log, 'la Dissipation retire trois États en silence').toHaveLength(3);
    expect(vus.map((e) => `${e.stateId}:${e.change}`).sort()).toEqual(['assourdi:loss', 'aveugle:loss', 'sonne:loss']);
  });

  it('la Surincantation de Durée (+2 pas) fait tenir les pions ×3 Rounds (×(1+n), LDB 47)', () => {
    lancerChamon(mage, cible, 2);
    expect(porteurs(vue(cible.id))[0].duration, 'la Surincantation n’a pas allongé l’effet porteur').toEqual({ scale: 'rounds', left: 9 });
    for (let i = 0; i < 8; i++) finDeRound();
    for (const id of ETATS) expect(stacks(vue(cible.id), id), `l’État ${id} est tombé avant l’échéance surincantée`).toBe(1);
    finDeRound();
    for (const id of ETATS) expect(stacks(vue(cible.id), id)).toBe(0);
  });

  /** Même geste, sur un Sort à ZONE persistante : la zone tient la MÊME durée surincantée que les
   *  États portés — une seule source de vérité (`overcastDurationParts`, LDB 47 l.15), aucun plancher. */
  function lancerGrandsFeux(caster: Combatant, cible: Combatant, steps = 0): void {
    const spell = findSpellById('grands-feux-d-u-zhul')!;
    const ocDur = overcastDurationParts(overcastSourceOf(spell), steps);
    const res = evaluateMissile(caster, cible, spell, cr());
    applyCast(useGame.getState, useGame.setState, caster, cible, spell, res, true, false, undefined, {
      durationMult: ocDur.mult, durationBonusRounds: ocDur.bonusRounds, overcastDurationSteps: steps,
    });
  }

  it('la ZONE d’un Sort suit la MÊME durée surincantée que ses États portés (BFM 3 → 3, +2 pas → 9)', () => {
    lancerGrandsFeux(mage, cible);
    expect(useGame.getState().battle!.zones![0].rounds, 'la zone ne dure pas la Durée du Sort').toBe(3);

    useGame.setState({ battle: { ...useGame.getState().battle!, zones: [] } });
    lancerGrandsFeux(mage, vue(cible.id), 2);
    expect(useGame.getState().battle!.zones![0].rounds, 'la zone ignore les pas de Surincantation').toBe(9);
  });

  it('le BONUS de Rounds (modèle Bénédiction : mult 1, +6 Rounds/pas) atteint la ZONE comme le reste du Sort', () => {
    const spell = findSpellById('grands-feux-d-u-zhul')!;
    const res = evaluateMissile(mage, cible, spell, cr());
    // `overcastDurationParts` DÉCOMPOSE la Surincantation en `mult` ET `bonusRounds` : la zone lit les
    // deux, comme la branche non-zone (`base × mult + bonus`) — sinon le bonus se perdait en route.
    applyCast(useGame.getState, useGame.setState, mage, cible, spell, res, true, false, undefined, {
      durationMult: 1, durationBonusRounds: 6, overcastDurationSteps: 1,
    });
    expect(useGame.getState().battle!.zones![0].rounds, 'le bonus de Rounds n’atteint pas la zone').toBe(3 + 6);
  });

  it('deux Chamon = deux effets porteurs = DEUX pions Assourdi (LDB 16 l.11, « les pénalités s’accumulent »)', () => {
    lancerChamon(mage, cible);
    lancerChamon(mage, vue(cible.id));
    const c = vue(cible.id);
    for (const id of ETATS) expect(stacks(c, id), `l’État ${id} ne s’est pas accumulé`).toBe(2);
    expect(derivedStacks(c, 'assourdi')).toBe(2);
    expect(porteurs(c)).toHaveLength(6);
  });

  it('un pion PORTÉ ne roule aucun Test de récupération de fin de Round ; un pion NATIF par-dessus, si', () => {
    lancerChamon(mage, cible);
    // Sonné a un `effects: onRoundEnd` de type `test` (etats.json) : l'énumérateur UNIQUE des sources
    // d'effets déclenchés (`effectSourcesOf` — voie inline ET collecteur de cascade) ne le propose plus.
    expect(effectSourcesOf(vue(cible.id)).some((s) => s.key === 'cond:sonne'), 'un Test de Résistance est proposé pour un Sonné PORTÉ').toBe(false);
    addCondition(vue(cible.id), 'sonne', 2); // 2 pions NATIFS par-dessus le pion porté
    const source = effectSourcesOf(vue(cible.id)).find((s) => s.key === 'cond:sonne');
    expect(source, 'le Sonné NATIF ne déclenche plus rien').toBeTruthy();
    expect(source!.stacks, 'le Test porte sur la part NATIVE seule (plancher = pions dérivés)').toBe(2);
  });
});

describe('Détermination sur un État PORTÉ — « Retirez un État » (LDB 17 l.61)', () => {
  it('la dépense du store n’écarte QUE l’État visé — les deux autres tiennent, et il revient en fin de Round', () => {
    lancerChamon(mage, cible);
    useGame.getState().spendResolveCondition(cible.id, 'sonne');
    const pendant = vue(cible.id);
    expect(pendant.resolve, 'le point de Détermination n’a pas été débité').toBe(2);
    expect(stacks(pendant, 'sonne'), 'la Détermination n’a pas écarté le Sonné').toBe(0);
    expect(stacks(pendant, 'aveugle'), 'la Détermination a emporté l’Aveuglé en prime').toBe(1);
    expect(stacks(pendant, 'assourdi'), 'la Détermination a emporté l’Assourdi en prime').toBe(1);
    // LDB 16 l.117 : la cause tient toujours → l'État revient à la fin du Round.
    finDeRound();
    expect(stacks(vue(cible.id), 'sonne'), 'le Sonné n’est pas revenu une fois la fenêtre refermée').toBe(1);
  });

  it('DEUX dépenses ouvrent DEUX fenêtres : Sonné ET Aveuglé partent, Assourdi tient, les deux reviennent', () => {
    lancerChamon(mage, cible);
    useGame.getState().spendResolveCondition(cible.id, 'sonne');
    useGame.getState().spendResolveCondition(cible.id, 'aveugle');
    const pendant = vue(cible.id);
    expect(pendant.resolve, 'les deux points n’ont pas été débités').toBe(1);
    expect(stacks(pendant, 'sonne')).toBe(0);
    expect(stacks(pendant, 'aveugle'), 'la 2ᵉ fenêtre a écrasé la 1ʳᵉ (un seul effectId)').toBe(0);
    expect(stacks(pendant, 'assourdi'), 'l’Assourdi est parti sans qu’aucun point ne le vise').toBe(1);
    finDeRound();
    const apres = vue(cible.id);
    for (const id of ETATS) expect(stacks(apres, id), `l’État ${id} n’est pas revenu (LDB 16 l.117)`).toBe(1);
  });

  it('la fenêtre n’écarte QUE l’État : les autres passifs de la MÊME source continuent d’être émis', () => {
    lancerChamon(mage, cible);
    const c = vue(cible.id);
    // Un passif NON-État porté par le MÊME Sort (canal `ActiveEffect.passive`, #1695).
    c.activeEffects!.push({ label: 'Transmutation de Chamon', bonus: 0, duration: { scale: 'rounds', left: 3 }, sourceSpellId: CHAMON, passive: [{ op: 'skillMod', skill: { id: 'escalade' }, mod: -10 }] });
    const fenetre = fenetreDetermination(c, 'sonne', 0, desDuTest)!;
    suspendSource(c, SRC, fenetre, 'Détermination (conscience)', 'determination-conscience:sonne', 'sonne');
    syncDerivedConditions(c);
    expect(stacks(c, 'sonne')).toBe(0);
    expect(passiveMods(c).some((m) => m.op.op === 'skillMod' && m.src?.id === CHAMON), 'la fenêtre a emporté un modificateur qui n’est pas un État').toBe(true);
  });
});

describe('Verrou d’État (LDB 18) et source d’un pion dérivé', () => {
  it('la fin de la source emporte le pion PORTÉ et laisse le pion NATIF verrouillé', () => {
    lancerChamon(mage, cible);
    const c = vue(cible.id);
    // Un Critique pose un 2ᵉ Aveuglé, VERROUILLÉ « tant que tous les Hémorragique ne sont pas éliminés »
    // (Tête 46-50) — le porteur en a un, le verrou tient.
    addCondition(c, 'hemorragique', 1);
    addCondition(c, 'aveugle', 1, undefined, undefined, undefined, undefined, { lockedUntil: { kind: 'compare', subject: { who: 'target', condition: 'hemorragique' }, op: '==', value: 0 } });
    expect(stacks(c, 'aveugle')).toBe(2);
    for (let i = 0; i < 3; i++) finDeRound(); // le Sort expire
    const apres = vue(cible.id);
    expect(stacks(apres, 'aveugle'), 'le pion NATIF verrouillé est parti avec la source').toBe(1);
    expect(derivedStacks(apres, 'aveugle'), 'le marquage a survécu à la fin de la source').toBe(0);
    expect(stacks(apres, 'sonne'), 'le Sonné porté n’est pas parti').toBe(0);
  });

  it('un pion ENTIÈREMENT dérivé part avec sa source même si un verrou a été posé par ailleurs', () => {
    lancerChamon(mage, cible);
    const c = vue(cible.id);
    c.conditions.find((x) => x.id === 'sonne')!.unlockBy = 'medicalAid'; // verrou d'acte de soin (LDB 18)
    for (let i = 0; i < 3; i++) finDeRound();
    expect(stacks(vue(cible.id), 'sonne'), 'un pion verrouillé a survécu à la source qui le portait').toBe(0);
  });

  it('un retrait NATIF reste INERTE sur un pion verrouillé (LDB 18) — le verrou ne protège que de LUI', () => {
    const c = mk('hero', 'blesse');
    addCondition(c, 'aveugle', 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    removeCondition(c, 'aveugle', 1);
    expect(stacks(c, 'aveugle'), 'le verrou d’acte de soin n’a pas tenu contre un retrait natif').toBe(1);
  });
});

describe('op `condition { carried }` — refus NOMINATIFS (#1695)', () => {
  const refus = (op: Record<string, unknown>): string => {
    const r = gameOpSchema.safeParse(op);
    expect(r.success, `la forme ${JSON.stringify(op)} a été ACCEPTÉE`).toBe(false);
    return r.success ? '' : r.error.issues.map((i) => i.message).join(' | ');
  };
  /** Une valeur NON NULLE plausible par champ exclu — la liste close est parcourue ENTIÈREMENT. */
  const valeurs: Record<(typeof CHAMPS_EXCLUS_DE_CARRIED)[number], unknown> = {
    durationRounds: 3, durationMinutes: 10, durationHours: 2, perRound: true,
    lockedUntil: { kind: 'always' }, unlockBy: 'medicalAid',
    escapeStrength: 40, escapeThreshold: 3, entangleOnFail: true, struggleDamage: 2, difficulte: 'difficile', argDifficulty: true, grapple: true,
  };

  it('chaque champ de `CHAMPS_EXCLUS_DE_CARRIED` est refusé en se NOMMANT — durées, verrous ET champs de lutte', () => {
    for (const champ of CHAMPS_EXCLUS_DE_CARRIED) {
      expect(refus({ op: 'condition', id: 'empetre', carried: true, [champ]: valeurs[champ] })).toContain(`« ${champ} »`);
    }
    // Les 5 champs de LUTTE sont nommément couverts : ils seraient PERDUS à la pose (`applyOps`).
    expect(CHAMPS_EXCLUS_DE_CARRIED).toContain('escapeStrength');
    expect(CHAMPS_EXCLUS_DE_CARRIED).toContain('grapple');
  });

  it('« carried » seul passe, et une durée SANS « carried » passe (le refus ne mord que le cumul)', () => {
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'sonne', carried: true }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'sonne', durationRounds: 3 }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'empetre', escapeStrength: 40 }).success).toBe(true);
  });

  it('« carried » sans DURÉE de contexte ne pose RIEN, et le dit au journal', () => {
    const c = mk('hero', 'seul');
    const lines = applyOps(c, [{ op: 'condition', id: 'sonne', carried: true }], { rng: deFixe(1) });
    expect(stacks(c, 'sonne'), 'un État PORTÉ a été posé sans source à durée — il serait permanent').toBe(0);
    expect(c.activeEffects ?? [], 'un effet porteur PERMANENT a été posé').toHaveLength(0);
    expect(lines.join(' | ')).toContain('« carried » exige une source à DURÉE');
  });

  it('un Sort à Durée INSTANTANÉE portant un `carried` est refusé au parse du document', () => {
    const base = findSpellById(CHAMON)!;
    const ok = spellEntreeSchema.safeParse(JSON.parse(JSON.stringify(base)));
    expect(ok.success, 'le Sort RÉEL, à Durée en Rounds, doit passer').toBe(true);
    const instantane = { ...JSON.parse(JSON.stringify(base)), duration: { kind: 'instant' } };
    const ko = spellEntreeSchema.safeParse(instantane);
    expect(ko.success, 'un Sort instantané portant trois États « pour la durée du Sort » a été ACCEPTÉ').toBe(false);
    expect(ko.success ? '' : ko.error.issues.map((i) => i.message).join(' | ')).toContain('« carried » exige une source à DURÉE');
  });
});
