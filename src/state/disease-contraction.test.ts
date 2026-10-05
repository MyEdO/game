import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { openCombatEndCascade, applyEffects } from './combatFlow';
import { contractDisease } from '../engine/disease';
import { seedBattleRng, battleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { spawnEnemy } from './spawn';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'a', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

function setBattle(combatants: Combatant[]) {
  useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as any });
}

/** Tests de fin de combat (maladie/Corruption) en flux cadence-aware : `openCombatEndCascade` collecte les
 *  étapes INFLUENÇABLES pour les héros conscients (cadence manuelle). On lance chaque étape puis on valide,
 *  jusqu'à fermeture (les conséquences mutent `c.diseases`/`c.corruption`). `finishCombatEnd` n'est pas
 *  requis hors victoire ; le writeback `party` n'est PAS testé ici (on lit les combattants du `battle`). */
function resolveCombatEnd(): void {
  openCombatEndCascade(useGame.getState, useGame.setState);
  for (let guard = 0; guard < 30; guard++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.combatEndBoundary) break;
    const cur = p.participants[p.cursor];
    // Les jets de bilan de combat sont des BANDES (#1117 L4) : on lance chaque RANGÉE ; une étape MONO
    // (upkeep différé non bandable) garde son lancer d'étape.
    if (cur?.participants) { for (const row of cur.participants) if (!row.result) useGame.getState().cascadeBatchRoll(row.id); }
    else if (cur?.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
}

describe('Fin de combat — infection post-critique (LDB 20 l.90) & persistance des maladies', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ mode: 'exploration', journal: [], pendingCascade: null }); });

  it('héros ayant subi un critique : Test de Résistance Très Facile (+60) — E 40 réussit → pas de maladie, flag consommé', () => {
    const combatant = hero({ id: 'a', tookCriticalThisFight: true }); // E 40 → cible ≥ 100 → réussite garantie
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases ?? []).toHaveLength(0);
    expect(combatant.tookCriticalThisFight).toBe(false); // consommé (idempotent)
  });

  it('héros E 30 ayant subi un critique : Test +60 raté → contracte une Infection Mineure (l.72)', () => {
    seedBattleRng(4); // 1er d100 = 93 > cible 90 (E 30 + 60) → échec garanti
    const combatant = hero({ id: 'a', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, tookCriticalThisFight: true });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases?.some((d) => d.id === 'infection-mineure')).toBe(true);
  });

  it('blessure PANSÉE pendant le combat (Guérison/bandage) → pas d’Infection post-critique (LDB 18 l.298)', () => {
    seedBattleRng(4); // ce seed ferait ÉCHOUER le Test +60 (E 30) sans pansement
    const combatant = hero({ id: 'a', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, tookCriticalThisFight: true, woundDressed: true });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases ?? []).toHaveLength(0); // pansé → aucune infection, aucune étape posée
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('une maladie déjà contractée survit à la fin du combat (aucun nouveau Test)', () => {
    const combatant = hero({ id: 'a', diseases: [contractDisease('infection-mineure', battleRng(), { incubation: 2, duration: 5 })!] });
    setBattle([combatant]);
    useGame.setState({ party: [hero({ id: 'a' })] });
    resolveCombatEnd();
    expect(combatant.diseases?.map((d) => d.id)).toEqual(['infection-mineure']);
  });
});

describe('Fin de combat — règle « Utilisation des Maladies » (disease-mode, LDB 20 l.35)', () => {
  beforeEach(() => { seedBattleRng(4); useGame.setState({ mode: 'exploration', journal: [], pendingCascade: null }); });
  afterEach(() => resetRule('disease-mode'));
  const e30 = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

  it("'off' : pas d'Infection Mineure post-critique, flag tookCriticalThisFight consommé", () => {
    setRule('disease-mode', 'off');
    const c = hero({ id: 'a', characteristics: e30, tookCriticalThisFight: true });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases ?? []).toHaveLength(0);
    expect(c.tookCriticalThisFight).toBe(false);
  });

  it("'situational' : pas d'Infection Mineure post-critique (sautée comme en 'off')", () => {
    setRule('disease-mode', 'situational');
    const c = hero({ id: 'a', characteristics: e30, tookCriticalThisFight: true });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases ?? []).toHaveLength(0);
  });

  it("'situational' : GARDE la Blessure Purulente d'un Trait Infecté (Skavens/Nurgle)", () => {
    setRule('disease-mode', 'situational');
    // Exposition unifiée (op exposeDisease) : Infecté → 'blessure-purulente' dans diseaseExposure.
    const c = hero({ id: 'a', characteristics: e30, diseaseExposure: [{ disease: 'blessure-purulente' }] });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases?.some((d) => d.id === 'blessure-purulente')).toBe(true);
  });

  it("'off' : pas de Blessure Purulente + exposition purgée", () => {
    setRule('disease-mode', 'off');
    const c = hero({ id: 'a', characteristics: e30, diseaseExposure: [{ disease: 'blessure-purulente' }] });
    setBattle([c]); useGame.setState({ party: [hero({ id: 'a', characteristics: e30 })] });
    resolveCombatEnd();
    expect(c.diseases ?? []).toHaveLength(0);
    expect(c.diseaseExposure).toBeUndefined();
  });
});

// #143 : le vrai prédicat RAW de la boucle de fin de combat est « suit les règles de Personnage »
// (LDB 18 l.5 « la plupart des Personnages » ; LDB 20 l.14/206 « Personnage »), pas `kind === 'hero'` —
// un ennemi MODÉLISÉ comme personnage (PNJ humain hostile, `followsCharacterRules`) fait ses Tests de
// fin de combat (maladie/Corruption) comme un héros ; une créature générique en reste exemptée.
describe('Fin de combat — prédicat personnage-vs-créature (#143, followsCharacterRules)', () => {
  beforeEach(() => { useGame.setState({ mode: 'exploration', journal: [], pendingCascade: null }); });

  const e30 = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  const enemy = (p: Partial<Combatant>): Combatant =>
    ({
      id: 'e', label: 'E', kind: 'enemy',
      characteristics: e30,
      wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
      weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      ...p,
    } as Combatant);

  it("un ennemi GÉNÉRIQUE (sans `followsCharacterRules`) n'a AUCUN Test de maladie de fin de combat, même après un critique", () => {
    seedBattleRng(4); // roll garanti raté si jamais testé (93 > toute cible raisonnable)
    const monster = enemy({ id: 'e', tookCriticalThisFight: true });
    setBattle([monster]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(monster.diseases ?? []).toHaveLength(0);
    expect(monster.tookCriticalThisFight).toBe(true); // jamais décidé → marqueur NON consommé (créature exemptée)
  });

  it('un ennemi PERSONNAGE (`followsCharacterRules: true`) contracte une Infection Mineure post-critique comme un héros (LDB 20 l.90)', () => {
    seedBattleRng(4); // 1er d100 = 93 > cible 90 (E 30 + 60) → échec garanti
    const npc = enemy({ id: 'e', followsCharacterRules: true, tookCriticalThisFight: true });
    setBattle([npc]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(npc.diseases?.some((d) => d.id === 'infection-mineure')).toBe(true);
    expect(npc.tookCriticalThisFight).toBe(false); // consommé (idempotent), comme un héros
  });

  it("un ennemi GÉNÉRIQUE exposé à la Corruption (créature affrontée corrompue) n'a AUCUN Test d'Exposition de fin de combat", () => {
    seedBattleRng(4);
    const corruptSource = enemy({ id: 'src', traits: [{ id: 'corruption', arg: 'mineure' }] });
    const monster = enemy({ id: 'e' });
    setBattle([corruptSource, monster]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(monster.corruption ?? 0).toBe(0);
  });

  it("un ennemi PERSONNAGE (`followsCharacterRules: true`) EST exposé à la Corruption de fin de combat comme un héros (LDB 19/85 p.338)", () => {
    seedBattleRng(4); // roll 93 > cible ~30 (Résistance Intermédiaire, E 30) → échec garanti → gain de Corruption
    const corruptSource = enemy({ id: 'src', traits: [{ id: 'corruption', arg: 'mineure' }] });
    const npc = enemy({ id: 'e', followsCharacterRules: true });
    setBattle([corruptSource, npc]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(npc.corruption ?? 0).toBeGreaterThan(0);
  });
});

// #152 (suite #143) : le flag `followsCharacterRules` doit aussi profiter aux ennemis spawnés depuis
// le BESTIAIRE (`spawnEnemy`, réf de scène), pas seulement aux statblocs d'éditeur — sinon un
// Cultiste/Brigand/Voleur (PNJ humain hostile) posé par `ref` échapperait à ses Tests de Personnage.
describe('Fin de combat — #152 : bestiaire humain rétro-flagué (CreatureData.followsCharacterRules)', () => {
  beforeEach(() => { useGame.setState({ mode: 'exploration', journal: [], pendingCascade: null }); });

  it('Cultiste (bestiaire, flagué) contracte une Infection Mineure post-critique comme un héros (LDB 20 l.90)', () => {
    seedBattleRng(4); // même graine que le #143 direct : E30 → 1er d100 93 > cible 90 → échec garanti
    const npc = spawnEnemy({ ref: 'cultiste' }, 'e', { x: 0, y: 0 });
    npc.tookCriticalThisFight = true;
    setBattle([npc]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(npc.diseases?.some((d) => d.id === 'infection-mineure')).toBe(true);
    expect(npc.tookCriticalThisFight).toBe(false); // consommé (idempotent), comme un héros
  });

  it('Orc (bestiaire, GÉNÉRIQUE non flagué) n’a AUCUN Test de maladie de fin de combat, même après un critique', () => {
    seedBattleRng(4);
    const npc = spawnEnemy({ ref: 'orc' }, 'e', { x: 0, y: 0 });
    npc.tookCriticalThisFight = true;
    setBattle([npc]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(npc.diseases ?? []).toHaveLength(0);
    expect(npc.tookCriticalThisFight).toBe(true); // jamais décidé → marqueur NON consommé (créature exemptée)
  });

  it('Cultiste (bestiaire, flagué) EST exposé à la Corruption de fin de combat comme un héros (LDB 19/85 p.338)', () => {
    seedBattleRng(4); // roll 93 > cible ~30 (Résistance Intermédiaire, E 30) → échec garanti → gain de Corruption
    const corruptSource = spawnEnemy({ ref: 'orc' }, 'src', { x: 0, y: 0 });
    corruptSource.traits = [{ id: 'corruption', arg: 'mineure' }];
    const npc = spawnEnemy({ ref: 'cultiste' }, 'e', { x: 0, y: 0 });
    setBattle([corruptSource, npc]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(npc.corruption ?? 0).toBeGreaterThan(0);
  });

  it('Orc (bestiaire, GÉNÉRIQUE non flagué) exposé à une créature corrompue n’a AUCUN Test de Corruption de fin de combat', () => {
    seedBattleRng(4);
    const corruptSource = spawnEnemy({ ref: 'orc' }, 'src', { x: 0, y: 0 });
    corruptSource.traits = [{ id: 'corruption', arg: 'mineure' }];
    const npc = spawnEnemy({ ref: 'orc' }, 'e', { x: 0, y: 0 });
    setBattle([corruptSource, npc]);
    useGame.setState({ party: [] });
    resolveCombatEnd();
    expect(npc.corruption ?? 0).toBe(0);
  });
});

describe('Effet d’éditeur inflictDisease (LDB 20)', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('contracte la maladie nommée sur le premier héros', () => {
    useGame.setState({ party: [hero({ id: 'a' })] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictDisease', disease: 'blessure-purulente' }]);
    expect(useGame.getState().party[0].diseases?.map((d) => d.id)).toEqual(['blessure-purulente']);
  });

  it('dédoublonne : pas deux fois la même maladie', () => {
    const a = hero({ id: 'a', diseases: [contractDisease('blessure-purulente', battleRng(), { incubation: 1, duration: 5 })!] });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictDisease', disease: 'blessure-purulente' }]);
    expect(useGame.getState().party[0].diseases).toHaveLength(1);
  });
});
