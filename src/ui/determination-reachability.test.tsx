// @vitest-environment jsdom
/**
 * DÉTERMINATION — les TROIS dépenses (LDB 17 l.59-61) sont atteignables sur la surface VIVANTE, la
 * console de combat : deux ALVÉOLES de la grille (immunité Psychologie, ignorer les modificateurs de
 * Critique) et la PASTILLE de l'État pour « Retirez un État » (arbitrage HUD 2026-08-16 : « Réactions
 * d'État sur la PASTILLE (`StateChips`+`GatedAction`) »). Aucune liste ne s'ouvre : le même arbitrage
 * bannit le tiroir, chaque dépense se prend là où elle s'affiche.
 *
 * Console MONTÉE pour de vrai (`createRoot`/`act`) sur le VRAI store — aucun module mocké, et l'effet
 * mesuré est celui du MOTEUR (réserve débitée, État retiré), jamais un drapeau d'UI.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { conditionLabel, findActionById } from '../data';
import { hasCondition } from '../engine/conditions';
import { actionGate } from '../state/actionRegistry';
import { emptyScene } from '../state/scene';
import { CombatConsole } from './CombatConsole';
import type { Combatant } from '../engine/types';

const BASE_CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const heros = (over: Partial<Combatant>) =>
  ({
    id: 'grimm', name: 'Grimm', label: 'Grimm', kind: 'hero', wounds: { current: 8, max: 12 },
    conditions: [], advantage: 0, weapons: [], skills: [], items: [], movement: 4, talents: [], traumas: [],
    engagedWith: [], size: 'moyenne', species: 'humains-reiklander', bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, career: 'agitateur',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { ...BASE_CHARS },
    ...over,
  }) as unknown as Combatant;

let host: HTMLDivElement;
let root: Root;

function monter(hero: Combatant) {
  act(() => {
    useGame.setState({
      battle: {
        combatants: [hero], order: [hero.id], baseOrder: [hero.id], turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
        log: [], over: null, preview: null,
      } as unknown as BattleState,
      scene: emptyScene(20, 20),
      mode: 'battle', party: [hero], pendingRoundStart: null, pendingAttack: null, pendingCast: null,
      pendingCleave: null, pendingDualStrike: null, pendingSiegeAim: null, hoverDelta: null,
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
  });
  act(() => { root.render(<CombatConsole />); });
}

const alveole = (id: string) => host.querySelector<HTMLButtonElement>(`.cc-cell[data-action="${id}"]`);
/** Boutons de la niche d'États de l'arche : une pastille ACTIONNABLE est un `<button>` (`GatedAction`). */
const pastilles = () => [...host.querySelectorAll<HTMLButtonElement>('.ptile-states button.pt-state')];
const actif = () => useGame.getState().battle!.combatants[0];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, party: [], mode: 'menu' } as never);
});

describe('Détermination — les trois usages sont ATTEIGNABLES depuis la console (LDB 17 l.59-61)', () => {
  it('usage 1 (l.59) — l’alvéole « immunité Psychologie » est vivante et DÉPENSE le point', () => {
    monter(heros({ resolve: 2, conditions: [], traumas: [] }));
    const c = alveole('resolve-psych-immune');
    expect(c, 'aucune alvéole d’immunité Psychologie dans la grille').toBeTruthy();
    expect(c!.disabled).toBe(false);
    act(() => c!.click());
    expect(actif().resolve, 'le clic n’a pas débité la réserve').toBe(1);
    expect(actif().activeEffects?.some((e) => e.psychImmune)).toBe(true);
  });

  it('usage 2 (l.60) — l’alvéole « ignorer les modificateurs de critique » est vivante et DÉPENSE le point', () => {
    // Aucune Blessure critique en cours : le RAW n'attache la dépense à AUCUNE condition d'état, et
    // `ignoreCritMods` porte au-delà des seules séquelles (il annule aussi les malus de maladie/faim,
    // `engine/trauma.ts:877`). La case reste donc offerte tant qu'il reste un point.
    monter(heros({ resolve: 1, conditions: [], traumas: [] }));
    const c = alveole('resolve-ignore-crit');
    expect(c, 'aucune alvéole « ignorer les modificateurs de critique »').toBeTruthy();
    act(() => c!.click());
    expect(actif().resolve).toBe(0);
    expect(actif().activeEffects?.some((e) => e.ignoreCritMods)).toBe(true);
  });

  it('réserve VIDE — les deux alvéoles restent DESSINÉES et portent leur raison, au SURVOL', () => {
    const h = heros({ resolve: 0, conditions: [] });
    monter(h);
    const attendue = actionGate('resolve-psych-immune', { active: h, battle: useGame.getState().battle! }).reason;
    for (const id of ['resolve-psych-immune', 'resolve-ignore-crit']) {
      const c = alveole(id)!;
      expect(c, `l’alvéole ${id} a disparu — la géométrie ne bouge jamais`).toBeTruthy();
      // Fermée par `aria-disabled` : elle porte une raison, elle doit rester focalisable (clavier,
      // manette, doigt) pour que cette raison soit atteignable.
      expect(c.getAttribute('aria-disabled')).toBe('true');
      expect(c.disabled).toBe(false);
      // La raison ne se grave PAS sous le nom du geste (arbitrage user 2026-08-24) : elle naît de
      // l'infobulle partagée au survol, et sa copie HORS ÉCRAN sert l'`aria-describedby`.
      act(() => { c.closest('.codex-ref')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
      expect(document.body.querySelector('.infobulle[role="tooltip"] [data-refus]')?.textContent).toBe(attendue);
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      const copie = c.querySelector('.hors-ecran[data-gate]')!;
      expect(copie.textContent).toBe(attendue);
      expect(c.getAttribute('aria-describedby')).toBe(copie.id);
    }
  });

  it('usage 3 (l.61) — la PASTILLE de l’État porte son retrait : le clic retire l’État et débite', () => {
    monter(heros({ resolve: 1, conditions: [{ id: 'aveugle', value: 1 }] as never }));
    const p = pastilles();
    expect(p.length, 'la pastille d’État ne porte aucun geste').toBe(1);
    act(() => p[0].click());
    expect(hasCondition(actif(), 'aveugle'), 'l’État n’a pas été retiré').toBe(false);
    expect(actif().resolve).toBe(0);
    // Le JOURNAL est une surface JOUEUR : il dit l'État par son LIBELLÉ, comme la pastille.
    const journal = useGame.getState().battle!.log;
    const ligne = journal[journal.length - 1].text;
    expect(ligne).toContain(conditionLabel('aveugle'));
    expect(ligne, 'le journal a servi l’id d’État au joueur').not.toContain('aveugle');
  });

  it('usage 3 — le geste NOMME l’État par son LIBELLÉ (jamais son id)', () => {
    monter(heros({ resolve: 1, conditions: [{ id: 'aveugle', value: 1 }] as never }));
    const nom = pastilles()[0].getAttribute('aria-label') ?? '';
    expect(nom).toContain(findActionById('resolve-remove-condition')!.label);
    expect(nom).toContain(conditionLabel('aveugle'));
    // Assertion NÉGATIVE sur l'id : le libellé (« Aveuglé ») et l'id (« aveugle ») sont des chaînes
    // distinctes — le témoin ci-dessus borne la mesure, celui-ci interdit d'afficher l'id au joueur.
    expect(nom, 'l’id d’État ne s’affiche JAMAIS').not.toContain('aveugle');
  });

  // CÂBLAGE de l'affordance : le style qui distingue la pastille-BOUTON de l'informative est keyé sur
  // `.pt-state.btn` (hud.css), et sa cible tactile de 44px sur `.pt-state.btn::after`. Si le bouton
  // cessait d'arriver par `GatedAction` (donc de porter `.btn`), les deux règles s'éteindraient sans
  // qu'aucun contrat CSS ne rougisse — c'est ce clou-ci qui les tient.
  it('usage 3 — la pastille ACTIONNABLE est un bouton `.btn` (la classe que le style de l’affordance vise)', () => {
    monter(heros({ resolve: 1, conditions: [{ id: 'aveugle', value: 1 }] as never }));
    const p = pastilles()[0];
    expect(p.tagName).toBe('BUTTON');
    expect([...p.classList], 'le bouton de la pastille n’arrive plus par GatedAction').toEqual(
      expect.arrayContaining(['btn', 'btn-nu', 'pt-state']),
    );
    // … et l'INFORMATIVE, elle, n'est pas un bouton (sinon la distinction n'aurait rien à distinguer).
    monter(heros({ resolve: 0, conditions: [{ id: 'aveugle', value: 1 }] as never }));
    expect(host.querySelector('.pt-state')!.matches('button.btn')).toBe(false);
  });

  it('réserve VIDE — la pastille redevient purement informative (aucun geste feint)', () => {
    monter(heros({ resolve: 0, conditions: [{ id: 'aveugle', value: 1 }] as never }));
    expect(pastilles()).toHaveLength(0);
    expect(host.querySelector('.ptile-states .pt-state'), 'la pastille elle-même reste dessinée').toBeTruthy();
  });
});
