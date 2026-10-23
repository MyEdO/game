/**
 * Effets d'éditeur de SANTÉ rendus authorables (audit jouabilité §B) : imposer la Faim (LDB 18),
 * l'Exposition froid/chaleur (LDB 18), et ouvrir les jeux de taverne (NADJ 16). Chacun s'applique
 * via `applyEffects` et réutilise son moteur PUR existant (provisions / exposure / tavernFlow).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { applierDe } from '../noyau/cascade';
import { resultLine } from '../noyau/rollSeam';
import { makePregens } from '../data/pregens';
import { findVehicleById } from '../data';
import { setRule, resetRule } from '../engine/policy';
import { effectiveChar } from '../engine/characteristics';
import type { WorldMap } from '../noyau/worldMap';
import { idNeufDeBanc } from '../lib/entityId.testkit';

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null });
  useGame.getState().seedRng(7);
});

describe('Effet inflictHunger (LDB 18 l.337-343)', () => {
  it('1 jour affamé → 1ᵉʳ échec : −10 en Force et en Endurance (via le pool de faim)', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    const baseF = effectiveChar(party[0], 'force');
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictHunger', days: 1, target: 'hero', heroId: party[0].id }]);
    const h = useGame.getState().party[0];
    expect(h.hunger?.failures).toBe(1);
    expect(effectiveChar(h, 'force')).toBe(baseF - 10); // 1ᵉʳ échec = −10 F/E (hungerCharPenalties)
  });

  it('2 jours → 2ᵉ échec : Dégâts encaissés (1d10 ignorant les PA, min 1) sur tout le groupe', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 2);
    const before = party.map((h) => h.wounds.current);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictHunger', days: 2, target: 'party' }]);
    const after = useGame.getState().party;
    expect(after[0].hunger?.failures).toBe(2);
    // 2ᵉ échec → au moins 1 Blessure sur chaque héros.
    expect(after[0].wounds.current).toBeLessThan(before[0]);
    expect(after[1].wounds.current).toBeLessThan(before[1]);
  });

  it('journalise l’affliction', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictHunger', days: 1, target: 'hero', heroId: party[0].id }]);
    expect(useGame.getState().journal.some((l) => /affam/i.test(l))).toBe(true);
  });
});

/** Pose un jet DÉTERMINISTE sur chaque rangée de l'étape COURANTE puis valide (aucun RNG en jeu). */
function commitRows(results: { roll: number; target: number; sl: number; success: boolean }[]): void {
  const pc = useGame.getState().pendingCascade!;
  const st = pc.participants[pc.cursor];
  const participants = st.participants!.map((p, k) => ({ ...p, result: results[k] }));
  useGame.setState({ pendingCascade: { ...pc, participants: pc.participants.map((x, i) => (i === pc.cursor ? { ...x, participants } : x)) } });
  useGame.getState().cascadeNext();
}

/** L'étape courante de la cascade ouverte. */
const current = () => { const pc = useGame.getState().pendingCascade!; return pc.participants[pc.cursor]; };

describe('Effet exposureNight (LDB 18 l.326-334) — BANDE influençable par VAGUE (#1117 L3)', () => {
  it('froid → UNE bande (la 1ʳᵉ vague) portant le nombre TOTAL de vagues, une rangée par héros, AUCUN jet résolu', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    useGame.getState().seedRng(3); // graine qui produisait des échecs à l'ancien (inline)
    const beforeW = useGame.getState().party[0].wounds.current;
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'froid', count: 4, target: 'hero', heroId: party[0].id }]);
    const pc = useGame.getState().pendingCascade;
    expect(pc).not.toBeNull(); // le jet est DIFFÉRÉ en modale, pas roulé en boucle
    const bands = pc!.participants.filter((s) => s.kind === 'exposure');
    expect(bands).toHaveLength(1); // UNE fenêtre ouverte : la vague 0 (les suivantes se construisent après)
    expect(bands[0].meta?.waves).toBe(4); // les 4 Tests RAW sont déclarés, pas perdus
    expect(bands[0].participants!.map((p) => p.id)).toEqual([party[0].id]);
    expect(bands[0].participants!.every((p) => p.result == null)).toBe(true); // rien résolu → rien de subi encore
    expect(bands[0].meta?.kind).toBe('froid');
    expect(useGame.getState().party[0].wounds.current).toBe(beforeW); // aucune Blessure encaissée en silence
  });

  it('chaleur → bande taguée kind "chaleur" ; SANS Possession lourde, la CONSÉQUENCE d’un échec pose Exténué + journal chaleur (l.330)', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    useGame.getState().party[0].items = []; // aucune Possession lourde → conséquence IMMÉDIATE
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'chaleur', count: 1, target: 'party' }]);
    const band = current();
    expect(band.kind).toBe('exposure');
    expect(band.meta?.kind).toBe('chaleur');
    const row = band.participants![0];
    commitRows([{ roll: 99, target: row.target, sl: -5, success: false }]);
    const h = useGame.getState().party[0];
    expect((h.conditions ?? []).some((c) => c.id === 'extenue')).toBe(true);
    expect(useGame.getState().journal.some((l) => /chaleur|suffoque|accablé/i.test(l))).toBe(true);
  });
});

describe('Exposition CHALEUR — annulation par délestage d’une Possession lourde (LDB 18 l.332)', () => {
  const heavyItem = { uid: 'sac-1', trappingId: 'grand-sac', name: 'Grand sac à dos', kind: 'misc', qualities: [], equipped: true, enc: 3 } as never;

  it('avec une Possession lourde : AUCUNE conséquence immédiate, un CHOIX est inséré qui NOMME la rangée qu’il tranche', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    useGame.getState().party[0].items = [heavyItem];
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'chaleur', count: 1, target: 'party' }]);
    const band = current();
    const row = band.participants![0];
    commitRows([{ roll: 99, target: row.target, sl: -5, success: false }]);
    const h = useGame.getState().party[0];
    expect((h.conditions ?? []).some((c) => c.id === 'extenue')).toBe(false); // choix non encore rendu, rien n'a été tranché
    expect(h.items).toHaveLength(1); // objet toujours en inventaire, rien n'a été jeté
    const choix = current();
    expect(choix.kind).toBe('exposure-heat-drop');
    expect(choix.options?.map((o) => o.key).sort()).toEqual(['garder', 'jeter']);
    // La coordonnée de l'annulation est la RANGÉE, plus l'adjacence : une bande peut en produire N.
    expect(choix.meta?.cancelsRowId).toBe(`${band.id}:${row.id}`);
  });

  it('« jeter » : retire l’objet, ANNULE le Test (aucune escalade)', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    const h = useGame.getState().party[0];
    h.items = [heavyItem];
    const choice = { id: 'e0-drop', kind: 'exposure-heat-drop', actorId: h.id, chosen: 'jeter', meta: { failNumber: 1 } } as unknown as import('../noyau/pendings').CascadeStep;
    const out = applierDe('exposure-heat-drop')!(useGame.getState, useGame.setState, choice, h, { steps: [choice], index: 0 });
    expect(h.items).toHaveLength(0); // délestée
    expect((h.conditions ?? []).some((c) => c.id === 'extenue')).toBe(false); // Test ANNULÉ, pas subi
    expect(/annulé/i.test(resultLine(out?.consequences ?? []))).toBe(true);
  });

  it('« garder » : conserve l’objet, la conséquence de l’échec s’applique normalement', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    const h = useGame.getState().party[0];
    h.items = [heavyItem];
    const choice = { id: 'e0-drop', kind: 'exposure-heat-drop', actorId: h.id, chosen: 'garder', meta: { failNumber: 1 } } as unknown as import('../noyau/pendings').CascadeStep;
    const out = applierDe('exposure-heat-drop')!(useGame.getState, useGame.setState, choice, h, { steps: [choice], index: 0 });
    expect(h.items).toHaveLength(1); // conservé
    expect((h.conditions ?? []).some((c) => c.id === 'extenue')).toBe(true); // 1ᵉʳ échec chaleur (l.330)
    expect(/chaleur|suffoque|accablé/i.test(resultLine(out?.consequences ?? []))).toBe(true);
  });

  it('escalade : la vague SUIVANTE se construit APRÈS le délestage — l’échec annulé ne compte pas dans son rang', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    useGame.getState().party[0].items = [heavyItem];
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'chaleur', count: 2, target: 'party' }]);
    const wave0 = current();
    commitRows([{ roll: 99, target: wave0.participants![0].target, sl: -5, success: false }]);
    // Le choix est courant : on JETTE → l'échec de la vague 0 est annulé, et c'est CE choix qui
    // déclenche la construction de la vague 1 (jamais avant : son escalade compterait l'échec annulé).
    expect(current().kind).toBe('exposure-heat-drop');
    useGame.getState().cascadeChoose(current().id, 'jeter');
    useGame.getState().cascadeNext();
    const wave1 = current();
    expect(wave1.kind).toBe('exposure');
    expect(wave1.meta?.wave).toBe(1);
    expect(wave1.participants![0].meta?.priorFails).toBe(0); // l'échec ANNULÉ ne compte pas
    useGame.setState({ journal: [] });
    commitRows([{ roll: 88, target: wave1.participants![0].target, sl: -4, success: false }]);
    // Ce 2ᵉ Test GENUINE est donc le 1ᵉʳ échec RÉEL (l.330 : −10 Int/FM + Exténué), PAS le 2ᵉ.
    const journal = useGame.getState().journal.join(' | ');
    expect(journal).toMatch(/suffoque/);
    expect(journal).not.toMatch(/accablé/);
  });
});

describe('Effet inflictThirst (LDB 18 l.340, miroir de la Faim)', () => {
  it('1 jour assoiffé → 1ᵉʳ échec : −10 Intelligence/FM/Sociabilité (via le pool de soif)', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    const baseInt = effectiveChar(party[0], 'intelligence');
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictThirst', days: 1, target: 'hero', heroId: party[0].id }]);
    const h = useGame.getState().party[0];
    expect(h.thirst?.failures).toBe(1);
    expect(effectiveChar(h, 'intelligence')).toBe(baseInt - 10);
  });

  it('2 jours → 2ᵉ échec : Dégâts encaissés (1d10 ignorant les PA, min 1) sur tout le groupe', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 2);
    const before = party.map((h) => h.wounds.current);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictThirst', days: 2, target: 'party' }]);
    const after = useGame.getState().party;
    expect(after[0].thirst?.failures).toBe(2);
    expect(after[0].wounds.current).toBeLessThan(before[0]);
    expect(after[1].wounds.current).toBeLessThan(before[1]);
  });

  it('journalise l’affliction', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictThirst', days: 1, target: 'hero', heroId: party[0].id }]);
    expect(useGame.getState().journal.some((l) => /sèche|déshydrat/i.test(l))).toBe(true);
  });
});

describe('Effet inflictPsychology (Peur/Terreur scénique, LDB 21) — BANDE INFLUENÇABLE', () => {
  it('ouvre UNE bande (une fenêtre pour la règle mise en jeu) à une RANGÉE par héros, AUCUN jet résolu (jamais silencieux)', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 2);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictPsychology', kind: 'peur', indice: 2, label: 'Une ombre glaçante', target: 'party' }]);
    const pc = useGame.getState().pendingCascade;
    expect(pc).not.toBeNull();
    const steps = pc!.participants.filter((s) => s.kind === 'encounterPsych');
    expect(steps).toHaveLength(1); // UNE entrée de règle = UNE bande (plus une étape par héros)
    expect(steps[0].participants?.map((p) => p.id)).toEqual(party.map((h) => h.id));
    expect(steps[0].participants?.every((p) => p.result == null)).toBe(true);
    expect(steps[0].encounterPsych?.kind).toBe('peur');
    expect(steps[0].encounterPsych?.indice).toBe(2);
  });

  it('kind terreur → bande taguée terreur, une seule rangée quand un seul héros est ciblé', () => {
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictPsychology', kind: 'terreur', indice: 3, label: 'Un spectre hurlant', target: 'hero', heroId: party[0].id }]);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.encounterPsych?.kind).toBe('terreur');
    expect(step.participants?.map((p) => p.id)).toEqual([party[0].id]);
  });
});

describe('Effet setVessel (navire de campagne, MDG 13-15)', () => {
  beforeEach(() => useGame.setState({ vessel: undefined }));

  it('dote le groupe du navire choisi (state.vessel posé, Moral par défaut, coque intacte)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue' }]);
    const v = useGame.getState().vessel;
    expect(v?.vehicleId).toBe('cogue');
    expect(v?.morale.score).toBe(75); // MORALE_BASE (nouvel équipage)
    expect(v?.wounds).toBeUndefined(); // coque intacte (aucun hullMax authoré)
    expect(useGame.getState().journal.some((l) => /navire|cogue/i.test(l))).toBe(true);
  });

  it('Moral et coque INITIAUX authorés sont appliqués', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue', morale: 60, hullMax: 50, hullCurrent: 20 }]);
    const v = useGame.getState().vessel;
    expect(v?.morale.score).toBe(60);
    expect(v?.wounds).toEqual({ current: 20, max: 50 });
  });

  it('ref invalide (véhicule non-navire / inexistant) → no-op (aucun navire posé)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'charrette' }]); // pas de facette ship
    expect(useGame.getState().vessel).toBeUndefined();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'zzz-inconnu' }]);
    expect(useGame.getState().vessel).toBeUndefined();
  });

  it('saboteurDR authoré initial (#214) est posé sur le navire de campagne', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue', saboteurDR: -3 }]);
    expect(useGame.getState().vessel?.saboteurDR).toBe(-3);
  });

  it('#241 — waterLitres authoré initial est posé sur le navire de campagne, clampé à ≥0', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue', waterLitres: -10 }]);
    expect(useGame.getState().vessel?.waterLitres).toBe(0);
    useGame.setState({ vessel: undefined });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue', waterLitres: 200 }]);
    expect(useGame.getState().vessel?.waterLitres).toBe(200);
  });

  it('#230 — nom d\'instance authoré : posé sur le navire ET interpolé au journal', () => {
    useGame.setState({ journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue', label: 'Le Cormoran' }]);
    expect(useGame.getState().vessel?.label).toBe('Le Cormoran');
    expect(useGame.getState().journal.some((l) => l.includes('Le Cormoran'))).toBe(true);
  });

  it('#230 — sans nom d\'instance : name absent, le journal porte le label du TYPE', () => {
    useGame.setState({ journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue' }]);
    expect(useGame.getState().vessel?.label).toBeUndefined();
    expect(useGame.getState().journal.some((l) => l.includes(findVehicleById('cogue')!.label))).toBe(true);
  });
});

describe('Effet adjustVessel (#233 — patch PARTIEL du navire de campagne, ≠ setVessel)', () => {
  beforeEach(() => useGame.setState({ vessel: undefined, journal: [] }));

  it('sans navire de campagne → no-op journalisé', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel', morale: 40 }]);
    expect(useGame.getState().vessel).toBeUndefined();
    expect(useGame.getState().journal.some((l) => /navire/i.test(l))).toBe(true);
  });

  it('aucun champ fourni → no-op journalisé, navire intact', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, saboteurDR: -2 } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel' }]);
    expect(useGame.getState().vessel?.morale.score).toBe(75);
    expect(useGame.getState().vessel?.saboteurDR).toBe(-2);
  });

  it('patch d\'un SEUL champ (saboteurDR) → Humeur de Manann/coque/Moral/nom/équipage INTACTS', () => {
    useGame.setState({
      vessel: {
        vehicleId: 'cogue',
        label: 'Le Cormoran',
        morale: { score: 60, lastMoraleWeek: 2, factors: ['x'] },
        wounds: { current: 10, max: 30 },
        manann: { applied: ['benediction'], score: 5 } as never,
        saboteurDR: -2,
        crew: [{ roleId: 'timonier', count: 1 }],
      },
    });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel', saboteurDR: 0 }]);
    const v = useGame.getState().vessel!;
    expect(v.saboteurDR).toBe(0);
    expect(v.label).toBe('Le Cormoran');
    expect(v.morale).toEqual({ score: 60, lastMoraleWeek: 2, factors: ['x'] });
    expect(v.wounds).toEqual({ current: 10, max: 30 });
    expect(v.manann).toEqual({ applied: ['benediction'], score: 5 });
    expect(v.crew).toEqual([{ roleId: 'timonier', count: 1 }]);
  });

  it('saboteurDR hors [-5,0] → clampé (MDG 14 l.45-47)', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel', saboteurDR: -9 }]);
    expect(useGame.getState().vessel?.saboteurDR).toBe(-5);
  });

  it('patch hullCurrent seul (coque déjà endommagée) → max préservé', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, wounds: { current: 10, max: 30 } } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel', hullCurrent: 25 }]);
    expect(useGame.getState().vessel?.wounds).toEqual({ current: 25, max: 30 });
  });

  it('#241 — patch waterLitres seul → posé, clampé à ≥0, reste des champs INTACT', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, saboteurDR: -2 } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel', waterLitres: -5 }]);
    expect(useGame.getState().vessel?.waterLitres).toBe(0);
    expect(useGame.getState().vessel?.saboteurDR).toBe(-2);
  });

  it('patch morale seul → score changé, semaine/facteurs préservés', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 3, factors: ['a'] } } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustVessel', morale: 20 }]);
    expect(useGame.getState().vessel?.morale).toEqual({ score: 20, lastMoraleWeek: 3, factors: ['a'] });
  });
});

describe('Effet adjustManann (#213 — MDG 15 l.83-125)', () => {
  beforeEach(() => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } });
    useGame.getState().seedRng(7);
  });

  it('sans navire de campagne → no-op journalisé', () => {
    useGame.setState({ vessel: undefined, journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustManann', factorId: 'petit-sacrifice' }]);
    expect(useGame.getState().vessel).toBeUndefined();
    expect(useGame.getState().journal.some((l) => /sans effet/i.test(l))).toBe(true);
  });

  it('facteur du tableau (petit sacrifice) applique son delta, une seule fois par navire (l.85)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustManann', factorId: 'petit-sacrifice' }]);
    const scoreAfterFirst = useGame.getState().vessel!.manann!.score;
    expect(scoreAfterFirst).toBeGreaterThan(0); // Petit sacrifice à Manann → +5
    expect(useGame.getState().vessel!.manann!.applied).toContain('petit-sacrifice');
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustManann', factorId: 'petit-sacrifice' }]);
    expect(useGame.getState().vessel!.manann!.score).toBe(scoreAfterFirst); // déjà appliqué → sans effet
  });

  it('delta maison chiffré (hors tableau) s’ajoute sans passer par le registre `applied`', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustManann', delta: { flat: 3, d10: 0, sign: 1 } }]);
    expect(useGame.getState().vessel!.manann!.score).toBe(3);
    expect(useGame.getState().vessel!.manann!.applied).toEqual([]);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'adjustManann', delta: { flat: 3, d10: 0, sign: -1 } }]);
    expect(useGame.getState().vessel!.manann!.score).toBe(0); // pas de garde-fou d'unicité → cumule
  });
});

describe('Effet openPort (#93 — MÊME chemin que l’accostage en mer)', () => {
  const worldMap: WorldMap = {
    id: 'm', label: 'Carte',
    places: [
      { id: 'sans-port', label: 'Village', pos: { x: 0, y: 0 }, scene: 'sc-village' },
      { id: 'avec-port', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'sc-port', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [],
  };

  beforeEach(() => {
    useGame.setState({ worldMap, pendingShoreLeave: null, scene: null, party: makePregens(idNeufDeBanc).slice(0, 1), journal: [] });
  });

  it('lieu SANS profil de port : aucune relâche à terre en attente (résout directement)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openPort', placeId: 'sans-port' }]);
    expect(useGame.getState().pendingShoreLeave).toBeNull();
  });

  it('lieu AVEC profil de port : ouvre `pendingShoreLeave` — MÊME état que l’accostage en mer', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openPort', placeId: 'avec-port' }]);
    expect(useGame.getState().pendingShoreLeave?.to.id).toBe('avec-port');
  });

  it('placeId inconnu → no-op (aucune casse)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openPort', placeId: 'zzz' }]);
    expect(useGame.getState().pendingShoreLeave).toBeNull();
  });
});

describe('Effet openTavernGames (NADJ 16)', () => {
  afterEach(() => resetRule('tavern-games'));

  it('option active → ouvre la modale (state tavernGames posé)', () => {
    setRule('tavern-games', true);
    useGame.setState({ party: makePregens(idNeufDeBanc).slice(0, 2), tavernGames: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openTavernGames' }]);
    expect(useGame.getState().tavernGames).not.toBeNull();
  });

  it('option éteinte → sans effet (comme interlude désactivé)', () => {
    setRule('tavern-games', false);
    useGame.setState({ party: makePregens(idNeufDeBanc).slice(0, 2), tavernGames: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openTavernGames' }]);
    expect(useGame.getState().tavernGames).toBeNull();
  });
});
