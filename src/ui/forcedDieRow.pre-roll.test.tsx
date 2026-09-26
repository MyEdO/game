// @vitest-environment jsdom
/**
 * Champ « Dé fixé » AVANT le jet, monté pour de VRAI (`RollRow` + `rowForcedDie`, le câblage exact
 * d'une modale : `CastModal` dérive le sélecteur pour ses rangées d'Opposition/Contre-sort). La saisie
 * doit LANCER le jet puis y substituer la valeur — un sélecteur pré-jet rendu sans déclencheur de jet
 * n'écrit nulle part (bug de recette : le champ était rendu mais mort sur ces rangées).
 * Patron réel du repo pour les tests interactifs : `createRoot`/`act` (pas de `@testing-library`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { rowForcedDie } from './forcedDieRow';
import { RollRow } from './RollRow';
import { RollShell } from './RollShell';
import { buildRollRow, drawRow } from './rollRowBuild';
import { Modal } from './Modal';
import { testPending, testBreakdown } from './breakdown';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    species: 'humains-reiklander',
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const ATT = C({ id: 'A', label: 'Att', resilience: 2 });
const DEF = C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 } });
/** Le MÊME combattant côté vue : le portrait de rangée compose un rig, dont l'arme de fixture (nom
 *  seul, hors registre) n'est pas résoluble — la vue n'en a pas besoin, le flux si. */
const VIEW = { ...ATT, weapons: [] } as Combatant;

/** Attaque NON LANCÉE (aucun résultat) : l'état exact d'une rangée pré-jet. */
function setupPreRoll() {
  seedBattleRng(7);
  useGame.setState({
    battle: { combatants: [ATT, DEF], log: [], order: ['A', 'B'], turn: 0, round: 1 } as never,
    pendingAttack: { attackerId: 'A', targetId: 'B', location: null, result: null } as never,
  });
}

/** Ce que fait le vrai résolveur quand on lance : pose un résultat (dé 88, raté). */
function resolveRoll() {
  const p = useGame.getState().pendingAttack!;
  useGame.setState({
    pendingAttack: {
      ...p,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: 'defender',
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      },
    } as never,
  });
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetDesFixes();
  useGame.setState({
    pendingAttack: null, pendingDefense: null, pendingCast: null, pendingTrample: null, battle: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetDesFixes();
});

/** UNE frappe dans un `<input type=number>` contrôlé par React (le commit ne s'y fait pas — #955). */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Geste TERMINAL du champ : c'est LUI qui commet la valeur saisie. */
function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

/** Saisie CLAVIER complète : chaque caractère frappé l'un après l'autre, puis Entrée. */
function typeAndCommit(input: HTMLInputElement, value: string) {
  let acc = '';
  for (const ch of value) {
    acc += ch;
    type(input, acc);
  }
  pressEnter(input);
}

const dieInput = () => host.querySelector('.rm-die-pick input[type="number"]') as HTMLInputElement | null;

describe('« Dé fixé » PRÉ-jet — le champ écrit vraiment (option ON, héros piloté)', () => {
  it('la saisie LANCE le jet puis substitue la valeur au d100', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const die = rowForcedDie(
      useGame.getState(),
      'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll: () => { calls.push('roll'); resolveRoll(); } },
      false,
    );
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
          onRoll={() => { calls.push('roll'); resolveRoll(); }}
        />,
      );
    });
    const input = dieInput();
    expect(input).not.toBeNull();
    typeAndCommit(input!, '33');
    expect(calls).toEqual(['roll']);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(33);
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });

  it('commit TERMINAL (#955) : les frappes de « 50 » ne lancent RIEN ; Entrée lance UNE fois, avec 50', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const onRoll = () => { calls.push('roll'); resolveRoll(); };
    const die = rowForcedDie(
      useGame.getState(),
      'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll },
      false,
    );
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
          onRoll={onRoll}
        />,
      );
    });
    const input = dieInput()!;
    type(input, '5');
    type(input, '50');
    expect(calls, 'une frappe qui lance = le « 5 » de « 50 » résout le Test').toEqual([]);
    expect(useGame.getState().pendingAttack!.result, 'aucun jet ne doit exister avant le geste terminal').toBeNull();
    expect(input.value, 'la frappe reste lisible dans le champ tant qu’elle n’est pas commise').toBe('50');
    pressEnter(input);
    expect(calls, 'Entrée lance UNE fois').toEqual(['roll']);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(50);
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });

  it('le champ est VIDE et s’annonce « Fixer le dé » — aucune valeur pré-remplie, aucune marque de provenance', () => {
    setDesFixes(true);
    setupPreRoll();
    const die = rowForcedDie(
      useGame.getState(),
      'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll: () => resolveRoll() },
      false,
    );
    expect(die.forcedRoll!.roll, 'un « 1 » pré-rempli ment : rien n’est fixé avant la saisie').toBeNull();
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
          onRoll={() => resolveRoll()}
          onForce={() => {}}
        />,
      );
    });
    const input = dieInput()!;
    expect(input.value).toBe('');
    expect(input.getAttribute('placeholder')).toBeTruthy();
    // L'ÉTIQUETTE du champ est une OFFRE, jamais la marque « ce jet a été fixé ».
    expect(host.querySelector('.rm-die-pick > label')?.textContent).toContain('Fixer le dé');
    expect(host.textContent).not.toContain('Dé fixé');
    expect(host.querySelector('.prow-fixed-mark')).toBeNull();
    // Hiérarchie : le choix de RÈGLE (Résilience) précède l'offre de CONFORT dans la zone d'actions.
    const act0 = host.querySelector('.prow-act')!;
    const kids = [...act0.children];
    const iResil = kids.findIndex((k) => (k.textContent ?? '').includes('Résilience'));
    const iChamp = kids.findIndex((k) => k.classList.contains('rm-die-pick'));
    expect(iResil).toBeGreaterThanOrEqual(0);
    expect(iChamp).toBeGreaterThan(iResil);
  });

  it('POST-résolution fixée : UNE seule surface — l’étiquette du champ devient « Dé fixé », la pastille ne double pas', () => {
    setDesFixes(true);
    setupPreRoll();
    resolveRoll();
    useGame.getState().attackSetForcedRoll(33);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: true, interactive: true, onRoll: null }, true);
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
        />,
      );
    });
    // Le champ PORTE la marque (libellé d'ÉTAT) et garde sa valeur éditable : pas de pastille en plus.
    const label = host.querySelector('.rm-die-pick > label')!;
    expect(label.textContent).toContain('Dé fixé');
    expect(label.textContent).not.toContain('Fixer le dé');
    expect((host.querySelector('.rm-die-pick input[type="number"]') as HTMLInputElement).value).toBe('33');
    expect(host.querySelector('.prow-fixed-mark'), 'pastille EN PLUS du champ : deux surfaces pour un seul fait').toBeNull();
    expect((host.textContent ?? '').split('Dé fixé').length - 1).toBe(1);
  });

  it('sans déclencheur de jet, AUCUN champ pré-jet n’est rendu (jamais d’affordance morte)', () => {
    setDesFixes(true);
    setupPreRoll();
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: false, interactive: true, onRoll: null }, false);
    expect(die.forcedRoll).toBeUndefined();
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled={false}
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
        />,
      );
    });
    expect(dieInput()).toBeNull();
  });

  it('UNE seule marque « Dé fixé » à l’écran : l’en-tête du sélecteur, pas un doublon de rangée', () => {
    setDesFixes(true);
    setupPreRoll();
    resolveRoll();
    useGame.getState().attackSetForcedRoll(33);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: true, interactive: true, onRoll: null }, true);
    expect(die.fixedMark).toBe(true);
    act(() => {
      root.render(
        <RollRow
          actor={VIEW}
          row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
          rolled
          interactive
          forcedRoll={die.forcedRoll}
          fixedMark={die.fixedMark}
          rollFrisson={false}
        />,
      );
    });
    const occurrences = (host.textContent ?? '').split('Dé fixé').length - 1;
    expect(occurrences).toBe(1);
  });
});

/** jsdom ne calcule aucune géométrie : sans rect non nul, `Modal` juge le bouton primaire invisible
 *  et son raccourci Entrée ne partirait JAMAIS — le test passerait pour la mauvaise raison. */
function makeVisible(el: HTMLElement) {
  el.getClientRects = (() => [{ width: 80, height: 24 }] as unknown as DOMRectList) as HTMLElement['getClientRects'];
}

describe('« Dé fixé » PRÉ-jet — le champ DANS une vraie modale', () => {
  /** Le câblage complet : `Modal` (son écouteur Entrée au document) + la rangée + son sélecteur. */
  function mountInModal(onRoll: () => void, applies: string[]) {
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: false, interactive: true, onRoll }, false);
    act(() => {
      root.render(
        <Modal title="Attaque" variant="roll">
          <RollRow
            actor={VIEW}
            row={{ combatant: VIEW, pending: testPending('Corps à corps', 45) }}
            rolled={false}
            interactive
            forcedRoll={die.forcedRoll}
            fixedMark={die.fixedMark}
            rollFrisson={false}
            onRoll={onRoll}
          />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => applies.push('apply')}>Appliquer</button>
          </div>
        </Modal>,
      );
    });
    makeVisible(host.querySelector<HTMLElement>('.modal-actions .btn-primary')!);
    return dieInput()!;
  }

  it('Entrée pose le dé et RIEN d’autre : un jet à 50, zéro clic sur l’action primaire', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const applies: string[] = [];
    const input = mountInModal(() => { calls.push('roll'); resolveRoll(); }, applies);
    act(() => input.focus());
    expect(document.activeElement, 'la frappe doit partir DU champ').toBe(input);
    typeAndCommit(input, '50');
    expect(calls, 'Entrée lance UNE fois').toEqual(['roll']);
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(50);
    expect(applies, 'Entrée validerait la modale PAR-DESSUS le dé posé').toEqual([]);
  });

  it('quitter le champ sans Entrée ne lance RIEN — et le brouillon SURVIT (le clic « Lancer » blur d’abord)', () => {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const input = mountInModal(() => { calls.push('roll'); resolveRoll(); }, []);
    act(() => input.focus());
    type(input, '5');
    type(input, '50');
    act(() => { input.blur(); input.dispatchEvent(new FocusEvent('blur', { bubbles: false })); });
    expect(calls, 'quitter le champ ne roule RIEN (cliquer « Annuler » ne doit pas lancer)').toEqual([]);
    expect(useGame.getState().pendingAttack!.result, 'aucun jet ne doit exister').toBeNull();
    // Le blur ne DÉTRUIT pas la saisie : tout clic sur un bouton blur le champ d'abord — un brouillon
    // effacé là faisait partir « Lancer » en dé naturel (cause racine, recette 4).
    expect(input.value, 'la saisie reste disponible pour le CTA').toBe('50');
  });
});

/**
 * #1117 (recette 2026-08-05, « Fixer le dé perd les frappes ») — CAUSE MESURÉE : sur une cascade à
 * plusieurs lignes, TOUS les champs portaient le même nom accessible (« Fixer le dé »), donc le geste
 * — clavier réel comme automate de recette — visait au hasard entre N spinbuttons. Le nom accessible
 * porte désormais SA ligne ; le libellé VISIBLE reste l'état du champ (offre / marque).
 */
describe('« Fixer le dé » — un nom accessible PAR LIGNE (#1117)', () => {
  /** Deux rangées pré-jet montées ensemble, comme une cascade à 2 lignes. */
  function mountTwoRows(): HTMLInputElement[] {
    setDesFixes(true);
    setupPreRoll();
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: false, interactive: true, onRoll: () => {} }, false);
    act(() => {
      root.render(
        <>
          <RollRow actor={VIEW} row={{ combatant: VIEW, pending: testPending('Voile', 45) }} rolled={false} interactive
            forcedRoll={die.forcedRoll} fixedMark={die.fixedMark} rollFrisson={false} onRoll={() => {}} />
          <RollRow actor={VIEW} row={{ combatant: VIEW, pending: testPending('Résistance', 45) }} rolled={false} interactive
            forcedRoll={die.forcedRoll} fixedMark={die.fixedMark} rollFrisson={false} onRoll={() => {}} />
        </>,
      );
    });
    return [...host.querySelectorAll('.rm-die-pick input[type="number"]')] as HTMLInputElement[];
  }

  it('chaque champ porte le nom de SA ligne — plus deux spinbuttons homonymes', () => {
    const inputs = mountTwoRows();
    expect(inputs).toHaveLength(2);
    const names = inputs.map((i) => i.getAttribute('aria-label'));
    expect(names).toEqual(['Fixer le dé — Voile', 'Fixer le dé — Résistance']);
    expect(new Set(names).size, 'deux noms accessibles DISTINCTS').toBe(2);
  });

  it('le libellé VISIBLE reste l’état du champ (l’offre), pas le nom de la ligne', () => {
    mountTwoRows();
    expect(host.querySelector('.rm-die-pick > label')?.textContent).toContain('Fixer le dé');
    expect(host.querySelector('.rm-die-pick > label')?.textContent).not.toContain('Voile');
  });

  it('la frappe reste dans le champ VISÉ (aucun reset au re-rendu de la rangée voisine)', () => {
    const inputs = mountTwoRows();
    act(() => inputs[1].focus());
    type(inputs[1], '3');
    type(inputs[1], '37');
    expect(inputs[1].value, 'le brouillon de la ligne visée survit').toBe('37');
    expect(inputs[0].value, 'la ligne voisine reste vierge').toBe('');
  });
});

/**
 * #1117 (recette 2, vécu 2× sur les lignes « Voile » de la cascade fluviale) — le joueur TAPE une
 * valeur dans « Fixer le dé » puis clique « Lancer » (sans Entrée ni blur) : le jet DOIT partir avec
 * SA valeur : le CTA commet le brouillon du champ, la protection `commitOnBlur:false` (quitter le
 * champ ne roule rien) restant entière.
 */
describe('« Fixer le dé » PRÉ-jet — taper PUIS cliquer « Lancer » (sans Entrée) pose bien le dé (#1117)', () => {
  /** Rangée pré-jet réelle (`rowForcedDie` + `RollRow`), avec son CTA « Lancer ». */
  function mountRow(): { input: HTMLInputElement; cta: HTMLButtonElement; calls: string[] } {
    setDesFixes(true);
    setupPreRoll();
    const calls: string[] = [];
    const die = rowForcedDie(
      useGame.getState(), 'attack',
      { actor: ATT, rolled: false, interactive: true, onRoll: () => { calls.push('roll'); resolveRoll(); } },
      false,
    );
    act(() => {
      root.render(
        <RollRow actor={VIEW} row={{ combatant: VIEW, pending: testPending('Voile', 45) }} rolled={false} interactive
          forcedRoll={die.forcedRoll} fixedMark={die.fixedMark} rollFrisson={false}
          onRoll={() => { calls.push('roll'); resolveRoll(); }} rollLabel="Lancer" />,
      );
    });
    const cta = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Lancer') as HTMLButtonElement;
    return { input: dieInput()!, cta, calls };
  }

  it('le dé SAISI est celui du jet — pas un d100 naturel', () => {
    const { input, cta } = mountRow();
    act(() => input.focus());
    type(input, '3');
    type(input, '37'); // frappe complète, AUCUNE validation
    act(() => { cta.click(); });
    expect(useGame.getState().pendingAttack!.result, 'le jet a bien eu lieu').toBeTruthy();
    expect(useGame.getState().pendingAttack!.result!.attackerRoll, 'le dé SAISI est celui qui résout').toBe(37);
  });

  it('le jet ne part QU’UNE fois (poser le dé lance déjà — pas de double jet)', () => {
    const { input, cta, calls } = mountRow();
    act(() => input.focus());
    type(input, '37');
    act(() => { cta.click(); });
    expect(calls, 'un seul passage par le résolveur').toEqual(['roll']);
  });

  it('champ VIDE : le CTA lance normalement (le d100 naturel reste le défaut)', () => {
    const { cta } = mountRow();
    act(() => { cta.click(); });
    expect(useGame.getState().pendingAttack!.result!.attackerRoll, 'aucune valeur saisie → dé naturel').toBe(88);
  });

  it('saisie HORS domaine : rien n’est posé, le jet reste naturel (refus honnête)', () => {
    const { input, cta } = mountRow();
    act(() => input.focus());
    type(input, '250'); // au-delà des faces
    act(() => { cta.click(); });
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(88);
  });
});

/**
 * #1117 (audit vague 5) — MÊME contrat de commit APRÈS le jet (rangée d'influence : « Dé fixé » +
 * « Relancer ») et RETOUR HONNÊTE d'une saisie hors domaine.
 */
describe('« Dé fixé » POST-jet et refus hors domaine (#1117)', () => {
  /** Rangée POST-jet : le jet a eu lieu, la rangée offre le champ + la relance. */
  function mountRolled(): { input: HTMLInputElement; reroll: HTMLButtonElement; calls: string[] } {
    setDesFixes(true);
    setupPreRoll();
    resolveRoll(); // un jet EXISTE (dé naturel 88)
    const calls: string[] = [];
    const onSet = (r: number) => { calls.push(`set:${r}`); };
    act(() => {
      root.render(
        <RollRow actor={{ ...VIEW, fortune: 2 }} row={{ combatant: VIEW, d: testBreakdown('Voile', 45, { roll: 88, target: 45, sl: -4, success: false }) }}
          rolled interactive rollFrisson={false} fortune={2}
          forcedRoll={{ roll: null, target: 45, fixed: true, commitOnBlur: false, onSet }}
          onReroll={() => { calls.push('reroll'); }} />,
      );
    });
    const reroll = [...host.querySelectorAll('button')].find((b) => /Relancer|Chance/i.test(b.textContent ?? '')) as HTMLButtonElement;
    return { input: dieInput()!, reroll, calls };
  }

  it('taper une valeur PUIS cliquer « Relancer » : la valeur est utilisée, et une seule fois', () => {
    const { input, reroll, calls } = mountRolled();
    expect(reroll, 'la rangée offre bien la relance').toBeTruthy();
    act(() => input.focus());
    type(input, '4');
    type(input, '42');
    act(() => { reroll.click(); });
    expect(calls, 'le dé SAISI est posé, et la relance ne part PAS en double').toEqual(['set:42']);
  });

  it('taper une valeur PUIS cliquer « Sombre Pacte » : la valeur est utilisée, et une seule fois', () => {
    // Le Sombre Pacte RELANCE (comme la Chance) : il commet donc le brouillon, au même titre.
    setDesFixes(true);
    setupPreRoll();
    resolveRoll();
    const calls: string[] = [];
    act(() => {
      root.render(
        <RollRow actor={{ ...VIEW, fortune: 0 }} row={{ combatant: VIEW, d: testBreakdown('Voile', 45, { roll: 88, target: 45, sl: -4, success: false }) }}
          rolled interactive rollFrisson={false}
          forcedRoll={{ roll: null, target: 45, fixed: true, commitOnBlur: false, onSet: (r) => { calls.push(`set:${r}`); } }}
          onDarkPact={() => { calls.push('pacte'); }} />,
      );
    });
    const pacte = [...host.querySelectorAll('button')].find((b) => /pacte/i.test(b.textContent ?? '')) as HTMLButtonElement;
    expect(pacte, 'la rangée offre bien le Sombre Pacte').toBeTruthy();
    const input = dieInput()!;
    act(() => input.focus());
    type(input, '4');
    type(input, '42');
    act(() => { pacte.click(); });
    expect(calls, 'le dé SAISI est posé, et le Pacte ne relance PAS en double').toEqual(['set:42']);
  });

  it('saisie HORS domaine : état invalide ANNONCÉ, domaine visible, aucun jet fantôme', () => {
    const { input, reroll, calls } = mountRolled();
    act(() => input.focus());
    type(input, '250');
    act(() => { reroll.click(); });
    expect(input.getAttribute('aria-invalid'), 'le refus est annoncé').toBe('true');
    expect(host.textContent, 'le DOMAINE est rendu apparent (fait, pas phrase d’aide) — les faces du dé').toContain('1–100');
    expect(calls.filter((c) => c.startsWith('set:')), 'aucun dé posé hors domaine').toEqual([]);
  });

  it('une nouvelle frappe efface l’état invalide (le refus ne colle pas au champ)', () => {
    const { input, reroll } = mountRolled();
    act(() => input.focus());
    type(input, '250');
    act(() => { reroll.click(); });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    type(input, '4');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
});

/**
 * #1117 (recette 3, bloquant) — le CTA « Lancer » d'une CASCADE n'est PAS celui de la rangée : quand
 * une seule rangée est lançable, `RollShell` HISSE le bouton dans sa barre (`RollShell.tsx`, cas mono)
 * et lance lui-même. C'est l'hôte RÉEL de toute cascade ; il consomme la MÊME poignée de commit
 * (`withPickedDie`, socle `forcedDieRow.ts`) que la rangée.
 */
describe('CTA HISSÉ de la coquille (hôte réel d’une cascade) — le dé saisi est celui du jet (#1117)', () => {
  /** Coquille MONO : une seule rangée lançable → le « Lancer » est hissé dans la barre. */
  function mountShell(): { input: HTMLInputElement; cta: HTMLButtonElement; rolls: number[] } {
    setDesFixes(true);
    setupPreRoll();
    const rolls: number[] = [];
    act(() => {
      root.render(
        <RollShell
          flowKey="attack"
          title="Journée de descente"
          rolled={false}
          rows={[buildRollRow(
            { actor: VIEW, row: { combatant: VIEW, pending: testPending('Voile', 45) }, onRoll: () => { resolveRoll(); rolls.push(useGame.getState().pendingAttack!.result!.attackerRoll); } },
            { key: 'r', interactive: true, rollFrisson: false },
          )]}
          actions={[]}
          onCancel={() => {}}
        />,
      );
    });
    const cta = [...host.querySelectorAll('.modal-actions button')].find((b) => /Lancer/.test(b.textContent ?? '')) as HTMLButtonElement;
    return { input: dieInput()!, cta, rolls };
  }

  it('le « Lancer » de la barre EXISTE (c’est bien lui que le joueur clique en cascade)', () => {
    const { cta, input } = mountShell();
    expect(cta, 'CTA hissé dans la barre d’actions').toBeTruthy();
    expect(input, 'le champ « Fixer le dé » est offert sur la rangée').toBeTruthy();
  });

  it('taper 95 PUIS cliquer le « Lancer » HISSÉ : le jet part avec 95, pas un dé naturel', () => {
    const { input, cta } = mountShell();
    act(() => input.focus());
    type(input, '9');
    type(input, '95');
    expect(input.value, 'la valeur est bien dans le DOM (repro du recetteur)').toBe('95');
    act(() => { cta.click(); });
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(95);
  });

  it('le jet hissé ne part QU’UNE fois (poser le dé lance déjà)', () => {
    const { input, cta, rolls } = mountShell();
    act(() => input.focus());
    type(input, '95');
    act(() => { cta.click(); });
    expect(rolls).toHaveLength(1);
  });
});

/**
 * #1508 T3b-4 (recette navigateur) — la coquille RESTE MONTÉE d'une étape-jet à la suivante, donc sa
 * poignée de commit (`RollShell.hoistDieCommit`) survit au champ « Fixer le dé » de l'étape d'avant.
 * Le champ démonté la RELÂCHE (`NumberField`) : sans cela, la garde `withPickedDie` reçoit `true` d'un
 * brouillon orphelin, avale le clic, et le CTA de l'étape suivante ne lance rien (Maladresse insoluble).
 */
describe('CTA HISSÉ d’une étape SANS champ de dé — le brouillon de l’étape précédente n’avale pas le clic (#1508)', () => {
  /** L'étape Maladresse : un tirage VIF, sans `flowKey` donc sans sélecteur de dé. */
  const oupsRows = (tire: () => void) => [drawRow({
    key: 'oups', row: { note: undefined }, rollLabel: 'Lancer sur le Tableau des Oups !', onRoll: tire, rollFrisson: false,
  })];
  const ctaOups = (): HTMLButtonElement =>
    [...host.querySelectorAll('.modal-actions button')].find((b) => /Tableau des Oups/.test(b.textContent ?? '')) as HTMLButtonElement;

  it('un dé SAISI non validé à l’étape d’avant : le « Lancer sur le Tableau des Oups ! » de la Maladresse tire quand même', () => {
    setDesFixes(true);
    setupPreRoll();
    const tires: string[] = [];
    act(() => {
      root.render(
        <RollShell flowKey="attack" title="Attaque" rolled={false}
          rows={[buildRollRow(
            { actor: VIEW, row: { combatant: VIEW, pending: testPending('Corps à corps', 45) }, onRoll: () => { resolveRoll(); } },
            { key: 'r', interactive: true, rollFrisson: false },
          )]}
          actions={[]} onCancel={() => {}} />,
      );
    });
    const input = dieInput()!;
    act(() => input.focus());
    type(input, '8');
    type(input, '88'); // frappé, JAMAIS validé : le joueur a laissé son brouillon en plan
    // MÊME instance de coquille (sa poignée de commit survit), étape suivante : la Maladresse.
    act(() => {
      root.render(
        <RollShell title="Maladresse" rolled={false} rows={oupsRows(() => tires.push('oups'))} actions={[]} onCancel={() => {}} />,
      );
    });
    expect(dieInput(), 'la Maladresse n’offre aucun champ de dé').toBeNull();
    act(() => { ctaOups().click(); });
    expect(tires, 'le tirage sur le Tableau des Oups ! part').toEqual(['oups']);
  });

  it('coquille montée À NEUF sur la Maladresse : le CTA hissé tire (non-régression)', () => {
    setDesFixes(true);
    setupPreRoll();
    const tires: string[] = [];
    act(() => {
      root.render(
        <RollShell title="Maladresse" rolled={false} rows={oupsRows(() => tires.push('oups'))} actions={[]} onCancel={() => {}} />,
      );
    });
    act(() => { ctaOups().click(); });
    expect(tires).toEqual(['oups']);
  });
});

/**
 * #1117 (audit, 3ᵉ hôte) — « TOUT LANCER » par rangées (`rollAllUnrolledRows`, consommé par
 * CascadeModal batch / CrewTest / ShipBattery / ShipManeuver) lançait N rangées d'un coup sans
 * consommer aucun brouillon : il n'apparaît qu'à ≥2 rangées lançables, donc précisément quand chaque
 * rangée détient sa poignée LOCALE. La coquille tient désormais un REGISTRE de poignées et applique
 * la garde rangée par rangée.
 */
describe('« Tout lancer » d’une fenêtre MULTI — chaque rangée consomme SON brouillon (#1117)', () => {
  /** Fenêtre multi : 3 rangées lançables + l'action groupée, montée dans la coquille réelle. */
  function mountMulti(): { inputs: HTMLInputElement[]; cta: HTMLButtonElement; rolls: string[] } {
    setDesFixes(true);
    setupPreRoll();
    const rolls: string[] = [];
    const mkRow = (id: string, label: string) => buildRollRow(
      {
        actor: { ...VIEW, id },
        row: { combatant: { ...VIEW, id }, pending: testPending(label, 45) },
        onRoll: () => { rolls.push(`${id}:naturel`); },
      },
      {
        key: id,
        interactive: true,
        rollFrisson: false,
        forcedRoll: { roll: null, target: 45, fixed: true, commitOnBlur: false, onSet: (r: number) => { rolls.push(`${id}:${r}`); } },
      },
    );
    act(() => {
      root.render(
        <RollShell
          flowKey="crewTest"
          title="Test d’équipage"
          rolled={false}
          rows={[mkRow('a', 'Voile'), mkRow('b', 'Ramer'), mkRow('c', 'Perception')]}
          actions={[{ key: 'rollAll', label: 'Tout lancer', onClick: () => { for (const id of ['a', 'b', 'c']) rolls.push(`${id}:naturel`); }, when: 'pre' }]}
          onCancel={() => {}}
        />,
      );
    });
    const cta = [...host.querySelectorAll('.modal-actions button')].find((b) => /Tout lancer/.test(b.textContent ?? '')) as HTMLButtonElement;
    return { inputs: [...host.querySelectorAll('.rm-die-pick input[type="number"]')] as HTMLInputElement[], cta, rolls };
  }

  it('taper 95 dans la rangée 2 puis « Tout lancer » : elle part à 95, les autres en naturel, chacune UNE fois', () => {
    const { inputs, cta, rolls } = mountMulti();
    expect(inputs, 'une saisie par rangée').toHaveLength(3);
    expect(cta, 'le verbe groupé est offert').toBeTruthy();
    act(() => inputs[1].focus());
    type(inputs[1], '9');
    type(inputs[1], '95');
    act(() => { cta.click(); });
    expect(rolls.filter((r) => r.startsWith('b:')), 'la rangée saisie part à 95, une seule fois').toEqual(['b:95']);
    expect(rolls.filter((r) => r.startsWith('a:'))).toEqual(['a:naturel']);
    expect(rolls.filter((r) => r.startsWith('c:'))).toEqual(['c:naturel']);
  });

  it('aucune saisie : le verbe du domaine s’applique tel quel (aucune sémantique réinterprétée)', () => {
    const { cta, rolls } = mountMulti();
    act(() => { cta.click(); });
    expect(rolls).toEqual(['a:naturel', 'b:naturel', 'c:naturel']);
  });
});

/**
 * #1117 (recette 4, CAUSE RACINE) — un clic sur un bouton BLUR d'abord le champ, puis exécute son
 * handler. Les trois hôtes étaient verts en test parce qu'en jsdom un `click()` programmatique ne
 * blur pas : le VRAI ordre d'événements (blur PUIS click) n'était joué nulle part. Ces trois cas le
 * jouent — c'est le test qui manquait aux trois vagues.
 */
describe('ORDRE RÉEL blur → clic : les 3 hôtes consomment quand même le dé saisi (#1117)', () => {
  it('CTA de RANGÉE : blur puis clic « Lancer » → le dé saisi résout', () => {
    setDesFixes(true);
    setupPreRoll();
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: ATT, rolled: false, interactive: true, onRoll: () => { resolveRoll(); } }, false);
    act(() => {
      root.render(
        <RollRow actor={VIEW} row={{ combatant: VIEW, pending: testPending('Voile', 45) }} rolled={false} interactive
          forcedRoll={die.forcedRoll} fixedMark={die.fixedMark} rollFrisson={false} rollLabel="Lancer"
          onRoll={() => { resolveRoll(); }} />,
      );
    });
    const input = dieInput()!;
    const cta = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Lancer') as HTMLButtonElement;
    act(() => input.focus());
    type(input, '95');
    act(() => { input.blur(); input.dispatchEvent(new FocusEvent('blur', { bubbles: false })); }); // ce que fait un vrai clic
    act(() => { cta.click(); });
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(95);
  });

  it('CTA HISSÉ de la coquille (cascade) : blur puis clic → le dé saisi résout', () => {
    setDesFixes(true);
    setupPreRoll();
    act(() => {
      root.render(
        <RollShell flowKey="attack" title="Journée de descente" rolled={false}
          rows={[buildRollRow(
            { actor: VIEW, row: { combatant: VIEW, pending: testPending('Voile', 45) }, onRoll: () => { resolveRoll(); } },
            { key: 'r', interactive: true, rollFrisson: false },
          )]}
          actions={[]} onCancel={() => {}} />,
      );
    });
    const input = dieInput()!;
    const cta = [...host.querySelectorAll('.modal-actions button')].find((b) => /Lancer/.test(b.textContent ?? '')) as HTMLButtonElement;
    act(() => input.focus());
    type(input, '95');
    act(() => { input.blur(); input.dispatchEvent(new FocusEvent('blur', { bubbles: false })); });
    act(() => { cta.click(); });
    expect(useGame.getState().pendingAttack!.result!.attackerRoll).toBe(95);
  });

  it('« TOUT LANCER » (multi) : blur puis clic → seule la rangée saisie part à 95', () => {
    setDesFixes(true);
    setupPreRoll();
    const rolls: string[] = [];
    const mkRow = (id: string, label: string) => buildRollRow(
      {
        actor: { ...VIEW, id }, row: { combatant: { ...VIEW, id }, pending: testPending(label, 45) },
        onRoll: () => { rolls.push(`${id}:naturel`); },
      },
      {
        key: id, interactive: true, rollFrisson: false,
        forcedRoll: { roll: null, target: 45, fixed: true, commitOnBlur: false, onSet: (r: number) => { rolls.push(`${id}:${r}`); } },
      },
    );
    act(() => {
      root.render(
        <RollShell flowKey="crewTest" title="Test d’équipage" rolled={false}
          rows={[mkRow('a', 'Voile'), mkRow('b', 'Ramer')]}
          actions={[{ key: 'rollAll', label: 'Tout lancer', onClick: () => { rolls.push('a:naturel'); rolls.push('b:naturel'); }, when: 'pre' }]}
          onCancel={() => {}} />,
      );
    });
    const inputs = [...host.querySelectorAll('.rm-die-pick input[type="number"]')] as HTMLInputElement[];
    const cta = [...host.querySelectorAll('.modal-actions button')].find((b) => /Tout lancer/.test(b.textContent ?? '')) as HTMLButtonElement;
    act(() => inputs[1].focus());
    type(inputs[1], '95');
    act(() => { inputs[1].blur(); inputs[1].dispatchEvent(new FocusEvent('blur', { bubbles: false })); });
    act(() => { cta.click(); });
    expect(rolls.filter((r) => r.startsWith('b:'))).toEqual(['b:95']);
    expect(rolls.filter((r) => r.startsWith('a:'))).toEqual(['a:naturel']);
  });
});
