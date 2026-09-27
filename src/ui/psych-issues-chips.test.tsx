// @vitest-environment jsdom
/**
 * #1189 — les CONSÉQUENCES de la Psychologie sont des `GameOp`, donc la bande DIT ses issues en chips
 * codex-liées (contrat d'affichage #1117), avant comme après le jet. Mesuré sur la VRAIE bande
 * (`openScriptedPsych` → `psychBands`, aucun pending forgé) et sur le VRAI applier (`cascadeNext`).
 *
 * RAW mesuré (LDB 21, `psychology.json:terreur`, verbatim) : « Sur un échec, vous gagnez autant
 * d'États *Brisé* que l'*Indice* de *Terreur* de la créature, auquel vous rajoutez les DR inférieurs
 * à 0. » puis « Une fois ce Test de Psychologie effectué, la créature cause la *Peur*, avec un
 * *Indice* de *Peur* équivalent à son *Indice* de *Terreur*. » — d'où DEUX issues annoncées : la
 * réussite ne porte que la Peur héritée (#1190), l'échec y ajoute l'État Brisé.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { openScriptedPsych } from '../state/encounterPsychFlow';
import { branchCertainOps } from '../state/combat/flowEval';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { CascadeBody } from './CascadeModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };

/** Héros à Force Mentale 10 (Calme 10) : son Test de Psychologie échoue sur tout dé > 10 — l'issue
 *  d'ÉCHEC est celle que l'on mesure, et elle est déterministe avec la graine posée. */
const hero = (): Combatant => ({
  id: 'h', name: 'h', label: 'Anselme', kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30,
    agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 10, sociabilite: 30, perception: 30 },
  conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [], weapons: [],
  advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 12 },
  resilience: 2, fortune: 2, species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

/** Ouvre la VRAIE bande de Terreur d'Indice 2 (Effet d'auteur `inflictPsychology`). */
function terreur() {
  const h = hero();
  useGame.setState({
    party: [h], battle: null, scene: testScene(), net: SOLO as never,
    pendingCascade: null, pendingLogQueue: [],
  } as never);
  openScriptedPsych(useGame.getState, useGame.setState, 'terreur', 2, 'Une vision terrifiante', [h]);
}

const bande = () => useGame.getState().pendingCascade!.participants[0];
const heroNow = () => useGame.getState().party[0];
const render = () => act(() => { root.render(<CascadeBody />); });
/** Les chips codex-liées du bloc des issues, dans l'ordre de rendu. */
const chips = () => [...host.querySelectorAll('.rm-stake .entity-chip')].map((n) => n.textContent?.trim());
/** La ligne d'issue du bloc CALCULÉ (`OutcomeNote` : « <b>Échec :</b> » + chips) — jamais la phrase
 *  d'enjeu rédigée de `StakeNote`, qui partage la classe `.rm-stake` mais rend une `<Prose>`. */
const ligne = (prefixe: string) =>
  [...host.querySelectorAll('.rm-stake p')]
    .filter((n) => n.querySelector('b'))
    .find((n) => n.textContent?.startsWith(prefixe))?.innerHTML;

beforeEach(() => {
  seedBattleRng(3); // graine du jet de rangée : dé 73 contre une cible de 10 → échec de −6 DR
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, battle: null, party: [], pendingLogQueue: [] });
});

describe('#1189 — la bande de Psychologie DIT ses issues en chips d’ops', () => {
  it('l’étape porte les DEUX branches en ops dérivées de psychology.json', () => {
    terreur();
    const step = bande();
    expect(branchCertainOps(step.meta?.onFail, heroNow())).toEqual([
      { op: 'condition', id: 'brise', value: 2, valuePerSL: { every: 1, amount: 1, onFailure: true } },
      { op: 'beginPsych', type: 'peur', indice: 2, calmeDR: 0, sourceId: 'scripted:Une vision terrifiante' },
    ]);
    expect(branchCertainOps(step.meta?.onSuccess, heroNow()), 'la réussite n’exempte que de la Terreur (LDB 21 l.56)').toEqual([
      { op: 'beginPsych', type: 'peur', indice: 2, calmeDR: 0, sourceId: 'scripted:Une vision terrifiante' },
    ]);
  });

  it('AVANT le jet : la chip dit la RÈGLE ENTIÈRE — base ET échelle par DR, jamais un nombre déjà faux', () => {
    terreur();
    render();
    expect(host.textContent).toContain('Réussite :');
    expect(host.textContent).toContain('Échec :');
    // PRÉ-jet : le rendu ne dispose d'aucun DR, donc la chip annonce la RÈGLE — la base « 2 (Indice) »
    // AVEC son échelle « +1 par DR d'échec » (LDB 21 l.54) — et non un « 2 × Brisé » que la résolution
    // démentirait. Chaque chip porte son libellé de fiche et son badge.
    expect(chips(), 'Réussite = Peur héritée ; Échec = Brisé (règle entière) PUIS Peur héritée')
      .toEqual(['Peur2', '2 × Brisé+1 par DR d’échec', 'Peur2']);
    const chip = host.querySelector('.rm-stake .entity-chip .codex-ref')!;
    expect(chip.getAttribute('role'), 'la chip ouvre sa fiche du Codex').toBe('button');
  });

  it('APRÈS le jet perdu : le verdict dit le nombre RÉSOLU, le MÊME que le journal et que l’état posé', () => {
    terreur();
    render();
    expect(ligne('Échec :'), 'la branche d’échec était annoncée AVANT le jet').toBeTruthy();

    act(() => { useGame.getState().cascadeBatchRoll('h'); });
    render();
    const res = bande().participants![0].result!;
    expect(res.success, 'Calme 10 : le Test est perdu').toBe(false);
    expect(res.sl, 'et perdu de 6 DR — la quantité d’État Brisé en dépend').toBe(-6);
    expect(ligne('Réussite :'), 'le verdict ne réannonce plus la branche non réalisée').toBeUndefined();
    // MÊMES ops, mais le DR est connu : la chip porte le nombre appliqué (2 + 6), plus l'échelle.
    expect(chips()).toEqual(['8 × Brisé', 'Peur2']);
    expect(ligne('Échec :')).not.toContain('2 × Brisé');
    expect(ligne('Échec :')).not.toContain('par DR d’échec');

    const rangee = bande().participants![0]; // l'applier écrit SON verdict sur cette rangée (la cascade se ferme après)
    act(() => { useGame.getState().cascadeNext(); });
    const h = heroNow();
    // Le nombre de la chip, celui du journal et celui de l'état posé sont UN SEUL nombre.
    expect(h.conditions.find((c) => c.id === 'brise')?.value, 'Brisé = Indice (2) + |DR négatifs| (6)').toBe(8);
    expect(rangee.outcome!.map((l) => l.text).join(' '), 'le verdict rédigé dit le MÊME 8').toContain('8');
    expect(h.psychState).toEqual([
      { type: 'peur', indice: 2, calmeDR: 0, sourceId: 'scripted:Une vision terrifiante' },
    ]);
  });
});
