// @vitest-environment jsdom
/**
 * SITE PILOTE du contrat d'affichage d'un jet (#1117) — LA SURPRISE (embuscade, LDB 13 l.52-81),
 * montée pour de VRAI (`CascadeBody`, patron `createRoot`/`act` d'`opposed-mask.test.tsx`).
 *
 * Contrat mesuré ici, sur la cascade que construit `applySurprise` (aucun pending forgé) :
 *  1. AVANT le jet — les deux issues sont des CHIPS d'ops (`OutcomeNote` ← `branchCertainOps`),
 *     l'échec portant la chip codex-liée de l'État Surpris ; aucune phrase d'enjeu rédigée.
 *  2. APRÈS le jet — le MÊME bloc filtré à la branche réalisée : le verdict rend les MÊMES chips que
 *     la branche d'échec annoncée (symétrie STRUCTURELLE, une seule dérivation).
 *  3. La Difficulté de l'opposition (LDB 12 l.166) se lit des DEUX côtés — celui qui a pré-jeté
 *     (l'embusqueur) comme celui qui répond.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { applySurprise } from '../state/combatFlow';
import { seedBattleRng, battleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { runCombatFlow } from '../state/combat/triggeredTest';
import { testFlow, EMPTY_FLOW } from '../state/flow';
import { testValue } from '../engine/skills';
import { CascadeBody } from './CascadeModal';
import { resolveStake, combatStakeRef, regles } from '../data';
import type { BattleState } from '../state/store';
import type { Combatant, TalentInstance } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };

/** Guetteur (valeur de Perception au choix) et embusqueur (Agilité/Discrétion FORTE).
 *  La Compétence Perception dérive de l'INITIATIVE (LDB 09) : c'est elle que porte `perception` ici,
 *  sans quoi la « Perception 5 » du guetteur ne serait pas la valeur que son Test lance. */
const chars = (perception: number, agilite: number) =>
  ({ 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: perception,
     agilite, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30, perception }) as never;

const mk = (id: string, kind: 'hero' | 'enemy', perception: number, agilite: number): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: chars(perception, agilite), conditions: [], traumas: [],
     engagedWith: [], skills: [], talents: [], items: [], weapons: [], advantage: 0, size: 'moyenne',
     pos: { x: kind === 'hero' ? 0 : 1, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

/** Ouvre la VRAIE cascade de Surprise : N héros embusqués vs embusqueur (Agilité/Discrétion 80).
 *  `talents` s'applique au PREMIER guetteur (`h`) ; les suivants (`h2`, `h3`…) sont nus. `perception`
 *  = celle de TOUS les guetteurs (65 : un Test SIMPLE réussirait — seule l'OPPOSITION les fait perdre). */
function ambush(talents: TalentInstance[] = [], guetteurs = 1, perception = 5) {
  const heroes = Array.from({ length: guetteurs }, (_, i) =>
    ({ ...mk(i === 0 ? 'h' : `h${i + 1}`, 'hero', perception, 30), ...(i === 0 ? { talents } : {}) }) as Combatant);
  const foe = mk('e', 'enemy', 30, 80);
  const ids = [...heroes.map((h) => h.id), 'e'];
  useGame.setState({
    party: heroes,
    battle: { combatants: [...heroes, foe], order: ids, baseOrder: ids, turn: -1, round: 1, action: null,
      reachable: new Map(), movementUsed: 0, acted: false, log: [], over: null } as unknown as BattleState,
    mode: 'battle', scene: testScene(), net: SOLO as never, pendingCascade: null, pendingLogQueue: [],
  });
  applySurprise(useGame.getState, useGame.setState, 'party');
}

/** La BANDE : l'unique étape de Surprise que la cascade porte. */
const bande = () => useGame.getState().pendingCascade!.participants[0];
/** Lance la rangée d'un guetteur (flux `cascadeBatch` — un jet PAR rangée). */
const lancer = (id: string) => act(() => { useGame.getState().cascadeBatchRoll(id); });

const render = () => act(() => { root.render(<CascadeBody />); });
/** Le bloc des issues, tel qu'il est rendu (chips comprises). */
const issues = () => [...host.querySelectorAll('.rm-stake')].map((n) => n.innerHTML);
/** Les chips codex-liées du bloc des issues : `catégorie:id` + libellé lu. */
const chips = () =>
  [...host.querySelectorAll('.rm-stake .entity-chip')].map((n) => n.textContent?.trim());
/** La LIGNE d'issue « Échec » du bloc, telle qu'elle est rendue (chips comprises). */
const ligneEchec = () =>
  [...host.querySelectorAll('.rm-stake p')].find((n) => n.textContent?.startsWith('Échec :'))?.innerHTML;

beforeEach(() => {
  seedBattleRng(7);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, battle: null, party: [], pendingLogQueue: [] });
});

describe('#1117 — la Surprise DIT ses issues en chips d’ops, avant comme après le jet', () => {
  it('AVANT le jet : « Réussite » / « Échec », l’échec portant la chip de l’État Surpris — aucune phrase', () => {
    ambush();
    render();
    const bloc = issues();
    expect(bloc.length, 'un seul bloc d’issues (l’enjeu n’a plus de gabarit rédigé)').toBe(1);
    expect(host.textContent).toContain('Réussite :');
    expect(host.textContent).toContain('Échec :');
    // La conséquence est une CHIP codex-liée (État Surpris), pas une phrase.
    expect(chips()).toEqual(['Surpris']);
    const chip = host.querySelector('.rm-stake .entity-chip .codex-ref')!;
    expect(chip.getAttribute('role'), 'la chip ouvre la fiche etats/surpris').toBe('button');
    // Le gabarit d'enjeu supprimé ne revient par aucune porte.
    expect(host.textContent).not.toContain('l’embuscade est repérée');
    expect(host.textContent).not.toContain('sauf si le Talent Vigilance');
  });

  /**
   * DIVISION ⓘ / chip (arbitrage user 2026-08-09, en jeu : « Pourquoi la popin "Surprise" indique l'état
   * surpris, de souvenir ce jet fait référence à une règle non ? »). Le ⓘ du titre ouvre la RÈGLE QUI
   * EXIGE le jet (LDB 13 l.67-71, fiche `regles/embuscade-surprise` — c'est elle qui explique pourquoi
   * un SEUL embusqué tire) ; la chip d'issue ouvre la CONSÉQUENCE appliquée (l'État Surpris). L'enjeu
   * ne pointait que l'État : la conséquence tenait lieu de règle.
   */
  it('le ⓘ du titre ouvre la RÈGLE d’embuscade, la chip ouvre l’État — deux portes distinctes', () => {
    const stake = resolveStake(combatStakeRef('ambushSurprise'));
    expect(stake.rule, 'le foyer du jet est la règle qui l’EXIGE, pas son issue').toEqual({ category: 'regles', id: 'embuscade-surprise' });
    // La fiche existe, et son texte est le passage du Source qui exige le Test opposé.
    const fiche = regles.find((r) => r.id === 'embuscade-surprise')!;
    expect(fiche.desc).toContain('Test opposé de **Discrétion/Perception**');
    expect(fiche.desc, 'le passage dit POURQUOI un seul embusqué tire').toContain('le Personnage ayant la Discrétion la plus faible');
    // Le Test de Vigilance, lui, garde son foyer sur le TALENT : c'est le talent qui en énonce la règle.
    expect(resolveStake(combatStakeRef('ambushVigilance')).rule).toEqual({ category: 'talents', id: 'vigilance' });
  });

  it('APRÈS le jet perdu : le verdict est le MÊME bloc, filtré à la branche réalisée', () => {
    ambush();
    render();
    const echecAvant = ligneEchec();

    lancer('h');
    render();

    const res = bande().participants![0].result!;
    expect(res.success, 'le guetteur à Perception 5 perd l’opposition').toBe(false);
    expect(host.querySelector('.rm-stake')!.innerHTML, 'le verdict ne réannonce plus la branche non réalisée').not.toContain('Réussite :');
    expect(echecAvant, 'la branche d’échec était bien annoncée AVANT le jet').toBeTruthy();
    expect(ligneEchec(), 'MÊMES chips, MÊME rendu que la promesse d’avant le jet').toBe(echecAvant);
    expect(chips()).toEqual(['Surpris']);
  });

  /**
   * LDB 12 l.166 (verbatim Source) : « Comme tout autre Test, certains Tests opposés sont plus ou moins
   * faciles, ou difficiles, que d'autres, et le MJ peut donc décider d'appliquer des modificateurs. Dans
   * la plupart des cas, ces modificateurs sont appliqués aux deux groupes […] ». La Difficulté d'une
   * opposition est donc UNE : elle frappe le pré-jet de l'embusqueur comme le jet du guetteur, et se LIT
   * des deux côtés. Mesuré sur une opposition DIFFICILE (−20) — à l'Intermédiaire (+0) du site, un
   * défaut d'affichage passerait inaperçu.
   */
  it('la Difficulté de l’opposition (LDB 12 l.166) frappe et se lit des DEUX côtés', () => {
    ambush();
    const battle = useGame.getState().battle!;
    const guetteur = battle.combatants.find((c) => c.id === 'h')!;
    const embusqueur = battle.combatants.find((c) => c.id === 'e')!;
    useGame.setState({ pendingCascade: null });
    runCombatFlow(
      { mode: 'combat', get: useGame.getState, set: useGame.setState, target: guetteur, caster: embusqueur, label: 'Surprise' },
      testFlow(
        // MÊME DÉCLARATION que le producteur réel (`applySurprise`, `state/combatFlow`) : un jet de
        // Surprise dit ce qu'il met en jeu (`ambushSurprise`). SEULE divergence, celle que ce test
        // mesure : la Difficulté DIFFICILE (le site réel oppose à l'Intermédiaire, où un défaut
        // d'affichage de la Difficulté passerait inaperçu).
        { skill: { id: 'perception' }, difficulty: 'difficile', label: 'Guet', stake: combatStakeRef('ambushSurprise'),
          opposed: { attacker: 'agilite', attackerSkill: 'discretion', attackerLabel: 'Discrétion' } },
        EMPTY_FLOW, EMPTY_FLOW,
      ),
    );
    const step = useGame.getState().pendingCascade!.participants[0];
    const aT = step.meta!.opposed!.aT;
    // Oracle = la valeur de Test de l'embusqueur, LUE à sa source (`testValue`) : `aT.base` ne peut pas
    // servir de référence — un `TestResult` ne porte de valeur nue que si son producteur la POSE
    // (LDB 12 l.160), et l'opposition de `triggeredTest` n'en pose pas.
    expect(aT.target, 'le pré-jet de l’embusqueur SUBIT la Difficulté (−20)').toBe(testValue(embusqueur, 'discretion', 'agilite') - 20);

    act(() => { useGame.getState().cascadeRoll(step.id); });
    render();
    const difficultes = [...host.querySelectorAll('.rm-roll-diff')].map((n) => n.textContent?.trim());
    expect(difficultes.length, 'les deux lignes du Test opposé portent LA Difficulté').toBe(2);
    expect(new Set(difficultes).size, 'une seule Difficulté pour l’opposition').toBe(1);
    expect(difficultes[0]).toContain('Difficile');
  });

  /**
   * Guetteur porteur du Talent VIGILANCE (LDB 11 l.168) : sa défaite n'a pas d'issue CERTAINE — un
   * second Test s'interpose. L'incertitude a pourtant un RESPONSABLE identifiable, et c'est lui qu'on
   * montre (arbitrage user 2026-08-07, « Chip du talent ») : la branche d'échec rend la CHIP du Talent,
   * cliquable vers sa fiche — laquelle énonce le Test de Perception qu'il ouvre. Zéro phrase. La branche
   * est ensuite jouée par l'exécuteur cadence-aware, qui APPEND l'étape « Vigilance » à la MÊME cascade.
   */
  it('porteur de Vigilance : l’échec annonce la CHIP du Talent, et ouvre son second jet', () => {
    ambush([{ talentId: 'vigilance', times: 1 }]);
    render();
    expect(host.textContent, 'l’issue de réussite reste certaine').toContain('Réussite :');
    expect(host.textContent, 'l’échec a un responsable : il se NOMME au lieu de se taire').toContain('Échec :');
    // …et ce responsable est le Talent, en chip codex-liée — jamais l'État Surpris (qu'il évite).
    expect(chips()).toEqual(['Vigilance']);
    const chipTalent = host.querySelector('.rm-stake .entity-chip .codex-ref')!;
    expect(chipTalent.getAttribute('role'), 'la chip ouvre la fiche talents/vigilance').toBe('button');

    lancer('h');
    act(() => { useGame.getState().cascadeNext(); });
    const suite = useGame.getState().pendingCascade!;
    expect(suite.participants.map((s) => s.label), 'le Test de Vigilance est APPENDU à la cascade').toContain('Vigilance');
    // …et il est JOUABLE : son identité ne collisionne pas avec le Test de Perception déjà résolu.
    const vigilance = suite.participants[suite.cursor];
    expect(vigilance.label).toBe('Vigilance');
    act(() => { useGame.getState().cascadeRoll(vigilance.id); });
    expect(useGame.getState().pendingCascade!.participants[suite.cursor].result, 'le second jet se lance').toBeTruthy();
  });
});

/**
 * LA BANDE (#1117) — LDB 13 l.77, verbatim Source : « le MJ demandera que soit effectué un Test opposé
 * de Discrétion/Perception, le plus souvent entre le Personnage ayant la Discrétion la plus faible et
 * tous les guetteurs potentiels. Si c'est le groupe en embuscade qui remporte le Test, chaque
 * Personnage vaincu subit alors l'État Surpris ». UN Test d'embusqueur, TOUS les guetteurs, un verdict
 * PAR guetteur : donc UNE fenêtre, une rangée par héros, et l'embusqueur en rangée témoin unique.
 */
describe('#1117 — la Surprise est UNE bande : un jet d’embusqueur, N guetteurs, un verdict par rangée', () => {
  it('une SEULE étape, une rangée par guetteur, l’embusqueur en rangée témoin unique', () => {
    ambush([], 3);
    const cascade = useGame.getState().pendingCascade!;
    expect(cascade.participants.length, 'une seule étape — plus de séquence « jet 1/3 »').toBe(1);
    expect(bande().participants!.map((p) => p.id)).toEqual(['h', 'h2', 'h3']);
    expect(bande().aggregate, 'jets INDÉPENDANTS : rien à agréger, chaque rangée porte sa conséquence').toBe('none');
    render();
    // 4 rangées : l'embusqueur (témoin, figé) + les 3 guetteurs.
    expect(host.querySelectorAll('.prow').length).toBe(4);
    // …et UN SEUL bloc d'issues : les 3 guetteurs annoncent la même chose, la bande le dit une fois.
    expect(issues().length, 'annonce MUTUALISÉE : une promesse identique ne se répète pas par ligne').toBe(1);
    expect(host.textContent, 'le sous-titre séquentiel a disparu').not.toContain('jet 1/');
  });

  it('l’embusqueur ne jette QU’UNE fois pour toute l’embuscade (l.77)', () => {
    seedBattleRng(11);
    ambush([], 3);
    const apres = battleRng().int(1, 100); // 1ᵉʳ tirage APRÈS l'ouverture de la bande
    const aT = bande().meta!.opposed!.aT;
    seedBattleRng(11);
    const rng = battleRng();
    rng.int(1, 100); // le jet de l'embusqueur…
    expect(apres, '…et rien d’autre : la bande n’a consommé QU’UN tirage').toBe(rng.int(1, 100));
    // Le même jet figé sert les 3 rangées : il n'y en a qu'un, porté par l'étape.
    expect(aT.roll).toBeGreaterThan(0);
  });

  it('chaque rangée porte SON verdict, et la Vigilance n’ouvre son second jet que pour SON porteur', () => {
    // Perception 65 : chacun RÉUSSIRAIT son Test simple — c'est l'OPPOSITION au jet figé de
    // l'embusqueur (Discrétion 80, DR 3) qui les fait perdre, et c'est elle qu'on mesure ici.
    seedBattleRng(11);
    ambush([{ talentId: 'vigilance', times: 1 }], 3, 65);
    lancer('h'); lancer('h2'); lancer('h3');
    const jets = bande().participants!.map((p) => p.result!);
    expect(jets.every((r) => r), 'les 3 rangées ont leur jet').toBe(true);
    expect(jets.every((r) => r.roll <= r.target), 'chaque dé est SOUS la cible : le Test simple serait réussi').toBe(true);
    expect(jets.every((r) => !r.success), 'et pourtant les 3 PERDENT — l’embusqueur remporte l’opposition').toBe(true);
    act(() => { useGame.getState().cascadeNext(); });
    const suite = useGame.getState().pendingCascade!;
    // UN seul second Test appendu — celui du porteur de Vigilance.
    expect(suite.participants.filter((s) => s.label === 'Vigilance').map((s) => s.actorId)).toEqual(['h']);
    // Les deux autres ont DÉJÀ subi l'État Surpris (branche d'échec jouée par rangée).
    const surpris = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.conditions.some((x) => x.id === 'surpris');
    expect([surpris('h2'), surpris('h3')], 'chaque Personnage vaincu subit l’État Surpris').toEqual([true, true]);
    expect(surpris('h'), 'le porteur de Vigilance attend son second Test').toBe(false);
  });

  /**
   * RÉSILIENCE + dé CHOISI sur une rangée de bande (LDB 17 l.68 : « au lieu de lancer les dés pour un
   * Test, vous choisissez le résultat »). Bout-en-bout, par les VERBES du store : le point payé achète
   * une réussite, et le dé choisi la CONSERVE — donc aucun État Surpris à la validation. L'accesseur de
   * dé de la bande doit ré-opposer le dé posé au jet figé ; s'il n'écrit que `{roll,target,sl}`, le
   * verdict disparaît, l'issue retombe en échec et le point est dépensé POUR RIEN.
   */
  it('Résilience puis dé CHOISI : la réussite payée SURVIT au choix du dé, aucun Surpris posé', () => {
    ambush([], 1, 65);
    const g = () => useGame.getState();
    const resilienceOf = (id: string) => g().battle!.combatants.find((c) => c.id === id)!.resilience ?? 0;
    const resAvant = resilienceOf('h');

    act(() => { g().cascadeBatchForceSuccess('h'); });
    expect(bande().participants![0].result!.success, '« Je ne faillirai pas ! » n’a pas produit de réussite').toBe(true);
    const resApres = resilienceOf('h');
    expect(resApres, 'le point de Résilience est dépensé').toBe(resAvant - 1);

    act(() => { g().cascadeBatchSetForcedRoll('h', 11); });
    const apres = bande().participants![0].result!;
    expect(apres.roll, 'le dé CHOISI est celui appliqué').toBe(11);
    expect(apres.success, 'la réussite PAYÉE par le point de Résilience a été perdue au choix du dé').toBe(true);
    expect(resilienceOf('h'), 'le choix du dé a re-dépensé une ressource').toBe(resApres);

    act(() => { g().cascadeNext(); });
    const surpris = g().battle!.combatants.find((c) => c.id === 'h')!.conditions.some((x) => x.id === 'surpris');
    expect(surpris, 'le guetteur a REMPORTÉ son Test : aucun État Surpris ne doit être posé').toBe(false);
  });

  /**
   * ANNONCE MUTUALISÉE (arbitrage user 2026-08-09, en jeu) — « "Réussite : rien. / Échec : Surpris" sur
   * chaque ligne de test c'est normal ? » : non. Une promesse IDENTIQUE se dit UNE fois, en tête de bande.
   * Ce qui reste par rangée : la rangée qui DIVERGE avant le jet, et le verdict d'une rangée résolue.
   */
  it('une rangée DIVERGENTE (Vigilance) garde son bloc — sa chip de Talent, pas la chip commune', () => {
    ambush([{ talentId: 'vigilance', times: 1 }], 3);
    render();
    // 2 blocs : l'annonce de bande (h2/h3) + le bloc PROPRE du porteur de Vigilance.
    expect(issues().length, 'la divergence ne se fond pas dans l’annonce commune').toBe(2);
    // Chacun nomme SON objet mécanique : l'État subi pour les non-porteurs, le Talent pour le porteur.
    const commun = issues().find((h) => h.includes('Surpris'))!;
    expect(commun, 'l’annonce de bande dit l’échec des non-porteurs').toContain('Échec');
    const divergent = issues().find((h) => !h.includes('Surpris'))!;
    expect(divergent, 'la rangée divergente NOMME le Talent qui prend la main').toContain('Vigilance');
    expect(divergent, 'et le dit sur SA ligne d’échec').toContain('Échec');
  });

  it('jets PARTIELS : verdicts par rangée jouée, annonce maintenue pour les rangées restantes, puis effacée', () => {
    ambush([], 3);
    lancer('h'); lancer('h2');
    render();
    // 2 verdicts individuels + l'annonce, toujours due aux rangées qui n'ont pas joué.
    expect(issues().length, '2 verdicts + l’annonce des rangées restantes').toBe(3);
    expect(issues().filter((h) => h.includes('Réussite') && h.includes('Échec')).length, 'l’annonce n’est plus que pour les restants').toBe(1);

    lancer('h3');
    render();
    // Plus rien à annoncer : 3 verdicts, aucune promesse de bande.
    expect(issues().length, 'toutes les rangées ont joué : l’annonce disparaît').toBe(3);
    expect(issues().every((h) => !(h.includes('Réussite') && h.includes('Échec'))), 'aucune promesse ne subsiste après le dernier jet').toBe(true);
  });
});
