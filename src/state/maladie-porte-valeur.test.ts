/**
 * #1657 B3-3 / #1685 — LE CYCLE DE MALADIE PASSE PAR LA PORTE, ET IL Y PORTE LA VALEUR DE LA PORTE.
 *
 * Doctrine (utilisateur 2026-08-24, `.claude/memory/user-doctrine-forme-canonique-unique-jets.md`) :
 * « A partir du moment ou je dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" si je
 * suis a l'initiative, que je le subit, face a un adversaire ou face a … une maladie ».
 *
 * Ce que ce fichier tient, sur le CHEMIN RÉEL du joueur (`openRest` → `restSleep`, les DEUX bâtisseurs
 * de la nuit, comme en jeu — jamais `deferredUpkeepSteps` appelé seul) :
 *  (i)   le Test de cycle du VER DE CARIE (MSRC 16 l.90 : « Test d'Endurance Accessible (+20) chaque
 *        jour ») est une ÉTAPE influençable dont la valeur est celle de la porte — Endurance NUE,
 *        États comptés (LDB 16 l.125 : « pénalité de -10 à tous les Tests ») ;
 *  (ii)  le `dailyTest` de la PNEUMONIE (EDOC 08 l.104 : « Test de Résistance Intermédiaire (+0) »)
 *        teste la COMPÉTENCE Résistance, pas l'Endurance — la donnée le NOMME, la porte le calcule ;
 *  (iii) le sommeil MULTI-JOURS (`sleepParty` — clôture d'interlude, triche de recette) monte les MÊMES
 *        étapes et les résout d'office par les appliers, au lieu de rouler dans le moteur sans trace ;
 *  (iv)  la branche `fail` s'applique sur un résultat INJECTÉ (jamais un dé tiré par le test).
 *
 * La cible d'un de ces Tests EST celle de la porte : Niveau de Compétence (ou Caractéristique) NU +
 * composantes NOMMÉES, États compris (`LDB 16 l.125` : « une pénalité de -10 à tous les Tests »). Les
 * écarts que les tests ci-dessous mesurent sont donc mesurés, jamais recopiés (#1685).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emptyScene } from '../noyau/monde/scene';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import { contractDisease, tickDisease } from '../engine/disease';
import { porteEntretien, applique } from '../engine/upkeepPorte.testkit';
import { testValue, skillBaseValue } from '../engine/skills';
import { addCondition, stacks, syncDerivedConditions } from '../engine/conditions';
import { clampTarget } from '../engine/tests';
import { DIFFICULTY_MODIFIERS, type Combatant } from '../engine/types';
import { creditBourse } from '../noyau/bourseFlow';
import type { CascadeRoll, CascadeStep } from '../noyau/pendings';
import { fixtureText } from '../i18n/fixtureText';
import { desDuTest } from '../engine/dice.testkit';

const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h1', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [{ id: 'resistance', advances: 12, characteristic: 'endurance' }], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, ...p,
  } as unknown as Combatant);

/** Rend le héros MALADE par le VRAI cycle (jamais une phase posée à la main), phase ACTIVE. */
function rendMalade(id: string, maladie: string, jours = 0): Combatant {
  const h = useGame.getState().party.find((x) => x.id === id)!;
  const dz = contractDisease(maladie, battleRng(), { incubation: 0 })!;
  h.diseases = [...(h.diseases ?? []), dz];
  // Avance du cycle jusqu'au Jᵉ jour de phase active — les Tests dus partent à la porte, on n'en juge
  // rien ici (c'est la nuit JOUÉE ci-dessous qui est le sujet).
  for (let j = 0; j < jours; j++) tickDisease(h, 24 * 60, battleRng(), () => {});
  useGame.setState((s) => ({ party: [...s.party] }));
  return h;
}

/** La nuit du joueur : auberge → « Dormir ». Rend les étapes de la cascade ouverte. */
function dort(): CascadeStep[] {
  useGame.getState().openRest({ lieu: fixtureText('Ici'), places: { auberge: true } });
  useGame.getState().restSleep();
  return useGame.getState().pendingCascade?.participants ?? [];
}

/** La rangée du héros dans une étape de nuit (mono ou bande — le mono EST le cas N=1). */
function rangee(step: CascadeStep, id: string): { base?: number; target?: number; mods?: { label: string; value: number }[] } {
  const row = step.participants?.find((r) => r.id === id);
  return (row ?? step) as never;
}

beforeEach(() => {
  vi.useFakeTimers();
  seedBattleRng(1);
  useGame.setState({ party: [hero()], battle: null, pendingRest: null, pendingCascade: null, scene: emptyScene('scene-test', 10, 10) });
  creditBourse(useGame.getState, useGame.setState, 'h1', { gold: 5, silver: 0, brass: 0 });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('#1685 — le Test de cycle d’une maladie porte la valeur de la PORTE', () => {
  it('ver de carie (MSRC 16 l.90) : étape influençable, cible = `testValue` d’ENDURANCE, États comptés', () => {
    // J+7 : la cadence du ver (`afterDays: 7`) démarre — le Test tombe alors chaque jour.
    const h = rendMalade('h1', 'vers-de-carie', 7);
    addCondition(h, 'sonne', 2); // LDB 16 l.125 : −10 par État à TOUS les Tests
    useGame.setState((s) => ({ party: [...s.party] }));

    const steps = dort();
    const tick = steps.find((s) => s.kind === 'diseaseTick' && (s.meta as { symptomId?: string })?.symptomId === 'vers-de-carie');
    expect(tick, 'le Test de cycle du ver est une ÉTAPE de la nuit (pas un jet du moteur)').toBeTruthy();

    const r = rangee(tick!, 'h1');
    const nue = skillBaseValue(h, undefined, undefined, 'endurance');
    const jetee = testValue(h, undefined, 'endurance');
    // Le témoin qui rend le test PROBANT : sans pénalité, base et valeur jetée seraient égales. Deux
    // sources pèsent ici, et la porte les compte TOUTES DEUX — les 2 États Sonné (−20, LDB 16 l.125) et
    // le passif du ver lui-même (−10 « à tous les Tests », MSRC 16 l.86).
    expect(jetee, 'États + passif du ver doivent séparer la nue de la valeur jetée').toBe(nue - 30);
    expect(r.base, 'base = Endurance NUE (l’Endurance est ce que le nœud NOMME)').toBe(nue);
    expect(r.target, 'cible = valeur de la porte + Accessible (+20)')
      .toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS.accessible).target);
    expect((r.mods ?? []).reduce((s, m) => s + m.value, 0), 'tout l’écart est NOMMÉ, rien d’anonyme').toBe(-30);
    // Contre-cible MESURÉE : une valeur qui compterait les avances de Résistance et ignorerait les États
    // (le régime que #1685 nomme) donnerait 40 + 12 + 20 ; la porte n'y passe pas.
    expect(r.target).not.toBe(clampTarget(40 + 12 + DIFFICULTY_MODIFIERS.accessible).target);
  });

  it('pneumonie (EDOC 08 l.104) : le `dailyTest` teste la COMPÉTENCE Résistance, valeur de la porte', () => {
    const h = rendMalade('h1', 'pneumonie', 0);
    addCondition(h, 'sonne', 1);
    useGame.setState((s) => ({ party: [...s.party] }));

    const steps = dort();
    const tick = steps.find((s) => s.kind === 'diseaseTick' && (s.meta as { symptomId?: string })?.symptomId === 'fievre');
    expect(tick, 'la pneumonie pose SON Test quotidien en étape').toBeTruthy();

    const r = rangee(tick!, 'h1');
    expect(r.base, 'base = Niveau de Compétence NU de Résistance (LDB 09 l.17)').toBe(skillBaseValue(h, 'resistance'));
    expect(r.target).toBe(clampTarget(testValue(h, 'resistance') + DIFFICULTY_MODIFIERS.intermediaire).target);
    // La Résistance (E + 12 avances) DIFFÈRE de l'Endurance nue : sans cette séparation, les deux
    // nœuds seraient indiscernables et le test ne prouverait pas que la donnée est lue.
    expect(skillBaseValue(h, 'resistance')).not.toBe(skillBaseValue(h, undefined, undefined, 'endurance'));
  });

  it('branche `fail` : la conséquence s’applique sur le résultat INJECTÉ dans l’étape, jamais sur un dé tiré ici', () => {
    rendMalade('h1', 'pneumonie', 0);
    const steps = dort();
    const idx = steps.findIndex((s) => s.kind === 'diseaseTick');
    expect(idx, 'la nuit porte le Test quotidien').toBeGreaterThanOrEqual(0);

    // ÉCHEC injecté sur la rangée du héros, puis validation de l'étape par la cascade.
    const p = useGame.getState().pendingCascade!;
    const ko: CascadeRoll = { roll: 100, target: 50, sl: -5, success: false };
    const injecte = (s: CascadeStep): CascadeStep => (s.participants
      ? { ...s, participants: s.participants.map((r) => ({ ...r, result: ko })) }
      : { ...s, result: ko });
    useGame.setState({
      pendingCascade: { ...p, cursor: idx, participants: p.participants.map((s, i) => (i === idx ? injecte(s) : s)) },
    });
    useGame.getState().cascadeNext();

    const fievre = useGame.getState().party[0].diseases![0].symptoms.find((s) => s.symptomId === 'fievre');
    expect(fievre?.severity, 'échec du Test quotidien → la Fièvre passe Grave (EDOC 08 l.104-108)').toBe('grave');
  });

  it('sommeil MULTI-JOURS : chaque Test résolu d’office LAISSE SA LIGNE — dé, cible et issue', () => {
    // Un second héros valide : la Fièvre peut mettre Hilda à terre, le groupe reste viable (`checkPartyWiped`).
    useGame.setState((s) => ({ party: [...s.party, hero({ id: 'h2', label: 'Hans' })] }));
    rendMalade('h1', 'pneumonie', 0);
    const journal: string[] = [];
    const vraiLog = useGame.getState().log;
    useGame.setState({ log: (l: string | string[]) => { journal.push(...(Array.isArray(l) ? l : [l])); vraiLog(l); } } as never);

    useGame.getState().restParty(3); // clôture d'interlude / triche de recette : 3 nuits d'affilée

    // Le cycle a AVANCÉ (les étapes ont été résolues par leurs appliers) et rien n'attend le joueur.
    expect(useGame.getState().pendingCascade, 'ce chemin résout d’office, il n’ouvre pas de fenêtre').toBeNull();
    expect(useGame.getState().party[0].diseases?.[0]?.activeDaysElapsed, 'trois journées de cycle traitées').toBe(3);

    // La PROPRIÉTÉ qui compte : un jet résolu sans fenêtre n'est pas muet — sa ligne porte le dé ET la
    // cible (forme `casc.autoRowTrace` : « Nom — Résistance : 99/42 → échec (DR -5). »). Une par Test.
    const lignesDeJet = journal.filter((l) => /[ ]:[ ]\d+[/]\d+[ ]→[ ]/.test(l));
    expect(lignesDeJet.length, `aucune ligne de dé dans le journal : ${journal.join(' | ')}`).toBeGreaterThanOrEqual(3);
    const [roll] = lignesDeJet[0].match(/(\d+)\/(\d+)/)!.slice(1).map(Number);
    expect(roll, 'le dé rendu est un d100').toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(100);
    // La cible est celle de la PORTE : la Résistance du héros à Intermédiaire (+0), jamais 0 ni une
    // valeur maison. L'état du héros ÉVOLUE d'une nuit à l'autre (Malaise → Exténué, LDB 20 l.188 ; Faim,
    // LDB 18 l.342) : seul le DERNIER Test est roulé dans l'état observé ici.
    const target = Number(lignesDeJet[lignesDeJet.length - 1].match(/(\d+)\/(\d+)/)![2]);
    const h = useGame.getState().party[0];
    expect(target, 'la cible rendue est celle que la porte a montée')
      .toBe(clampTarget(testValue(h, 'resistance') + DIFFICULTY_MODIFIERS.intermediaire).target);
  });

  it('sommeil MULTI-JOURS sous un slot DÉJÀ vivant : chaque nuit se déroule — le pilote n’est interrompu que par un slot qu’IL a écrit', () => {
    // Un second héros valide : la défaite (`checkPartyWiped`) ne peut pas être ce qui interrompt.
    useGame.setState((s) => ({ party: [...s.party, hero({ id: 'h2', label: 'Hans' })] }));
    rendMalade('h1', 'pneumonie', 0);
    useGame.getState().openRest({ lieu: fixtureText('Ici'), places: { auberge: true } });
    useGame.getState().restSleep();
    const vivant = useGame.getState().pendingCascade;
    expect(vivant, 'une fenêtre de nuit est ouverte AVANT le sommeil multi-jours').toBeTruthy();

    const journal: string[] = [];
    const vraiLog = useGame.getState().log;
    useGame.setState({ log: (l: string | string[]) => { journal.push(...(Array.isArray(l) ? l : [l])); vraiLog(l); } } as never);

    useGame.getState().restParty(2);

    const lignesDeJet = journal.filter((l) => /[ ]:[ ]\d+[/]\d+[ ]→[ ]/.test(l));
    expect(lignesDeJet.length, `les DEUX nuits roulent leur Test : ${journal.join(' | ')}`).toBeGreaterThanOrEqual(2);
    expect(useGame.getState().pendingCascade, 'le slot vivant à l’entrée reste le sien').toBe(vivant);
  });

  it('B2 — le HARNAIS de test et la NUIT réelle appliquent la MÊME guérison (Exténué collant compris)', () => {
    // `applyDiseaseEnd` est le foyer unique : la fin de Durée retire la maladie ET réconcilie les États
    // PORTÉS par les passifs de ses symptômes (`LDB 20 l.188`, l'Exténué du Malaise). Un kit qui n'en
    // ferait que la moitié mentirait sur ce que la nuit fait — c'est ce que ce test interdit, en
    // comparant les DEUX chemins sur la même fixture.
    const parLeKit = (() => {
      const c = hero({ id: 'kit' });
      const dz = contractDisease('infection-mineure', battleRng(), { incubation: 0, duration: 1 })!;
      c.diseases = [dz];
      const { specs, defer } = porteEntretien();
      tickDisease(c, 24 * 60, battleRng(), defer);
      syncDerivedConditions(c); // l'État que le Malaise PORTE, posé par le socle
      for (const s of specs) applique(c, s, { success: true }, desDuTest);
      return { extenue: stacks(c, 'extenue'), maladies: (c.diseases ?? []).length };
    })();

    const parLaNuit = (() => {
      const h = useGame.getState().party[0];
      const dz = contractDisease('infection-mineure', battleRng(), { incubation: 0, duration: 1 })!;
      h.diseases = [dz];
      syncDerivedConditions(h);
      useGame.setState((st) => ({ party: [...st.party] }));
      const steps = dort();
      const p = useGame.getState().pendingCascade!;
      const ok: CascadeRoll = { roll: 1, target: 99, sl: 5, success: true };
      const injecte = (s: CascadeStep): CascadeStep => (s.participants
        ? { ...s, participants: s.participants.map((r) => ({ ...r, result: ok })) }
        : { ...s, result: ok });
      useGame.setState({ pendingCascade: { ...p, participants: p.participants.map(injecte) } });
      for (let g = 0; g < steps.length + 4 && useGame.getState().pendingCascade; g++) useGame.getState().cascadeNext();
      const h2 = useGame.getState().party[0];
      return { extenue: stacks(h2, 'extenue'), maladies: (h2.diseases ?? []).length };
    })();

    expect(parLeKit.maladies, 'la cure retire la maladie des deux côtés').toBe(0);
    expect(parLaNuit.maladies).toBe(0);
    expect(parLeKit.extenue, 'l’État porté par le passif est réconcilié des DEUX côtés — même foyer').toBe(parLaNuit.extenue);
    expect(parLaNuit.extenue, 'la guérison retire l’Exténué du malaise (LDB 20 l.188)').toBe(0);
  });
});
