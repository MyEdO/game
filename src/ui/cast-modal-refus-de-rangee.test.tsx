// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { seedBattleRng } from '../noyau/battleRng';
import { openCastOpposition } from '../noyau/combatFlow';
import { testScene } from '../scenes/test-fixture';
import { CastModal } from './CastModal';
import type { Combatant } from '../engine/types';
import type { PendingCast } from '../noyau/pendings';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { unarmedWeapon } from '../engine/items';

/** Fenêtre d'incantation : la rangée de Contre-sort ferme ses gestes sur le refus de son slot, la rangée
 *  d'opposition annonce la ligne que la cible roule. LDB 46 l.156 ; LDB 12 l.166 ; LDB 17 l.24/l.68. */
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, label: string, kind: 'heros' | 'ennemi', extra: Partial<Combatant> = {}): Combatant =>
  blessuresSurLeProfil({ id, name: id, label, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [],
    skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 20 }], talents: [], items: [],
    weapons: [unarmedWeapon()], advantage: 0, size: 'moyenne', pos: { x: kind === 'heros' ? 0 : 1, y: 0 }, wounds: blessuresDeBase(18),
    resilience: 2, fortune: 2, species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...extra } as unknown as Combatant);
const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };
const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' };
const DISSIPE = { dispelled: true, counter: { roll: 5, target: 60, sl: 4, success: true, isDouble: false }, casterNetSL: -1, log: 'dissipé' };
const RATE = { dispelled: false, counter: { roll: 95, target: 60, sl: -4, success: false, isDouble: false }, casterNetSL: 7, log: 'raté' };
let host: HTMLDivElement; let root: Root;

function poser(combatants: Combatant[], pendingCast: PendingCast, extra: Record<string, unknown> = {}) {
  useGame.setState({
    battle: { combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id), turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as never,
    mode: 'battle', scene: testScene(), net: SOLO as never, party: combatants.filter((c) => c.kind === 'heros'),
    pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingCastOpposition: null, pendingCounterspell: null,
    pendingCast, ...extra,
  });
}
function monterContreSort(parts: unknown[]) {
  poser([mk('E', 'Ennemi', 'ennemi'), mk('A', 'Anna', 'heros'), mk('B', 'Bert', 'heros')],
    { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, counterspellRouted: true, result: ENEMY_CAST } as never,
    { pendingCounterspell: { participants: parts } });
  act(() => { root.render(<CastModal />); });
}
const boutons = () => [...host.querySelectorAll('button')].map((b) => `${(b.textContent ?? '').trim()}${b.getAttribute('aria-disabled') === 'true' ? ' [fermé]' : ''}`);
const raisonDe = (id: string) => document.getElementById(`prow-roll-${id}-reason`)?.textContent ?? null;
beforeEach(() => { seedBattleRng(7); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); useGame.setState({ pendingCast: null, pendingCounterspell: null, pendingCastOpposition: null, battle: null, party: [] }); });

describe('Contre-sort — la rangée refusée ne propose aucun geste et dit le refus', () => {
  it('phase de déclaration : CTA, « Laisser passer » et « Appliquer » fermés sur l’attente, aucune Résilience avant jet', () => {
    monterContreSort([{ id: 'A', interactive: true, declared: 'solo', result: null }, { id: 'B', interactive: true, result: null }]);
    expect(boutons()).toEqual(['Contrer seul', 'S’unir [fermé]', 'Passer', 'Contre-sort [fermé]', 'Contrer seul', 'S’unir [fermé]', 'Passer', 'Contre-sort [fermé]', 'Laisser passer [fermé]', 'Appliquer [fermé]']);
    expect(raisonDe('A')).toBe('En attente des déclarations de la fenêtre');
  });

  it('dissipé par un autre, rangée non lancée : CTA fermé sur « Déjà dissipé par Bert », ni Résilience ni dé', () => {
    monterContreSort([{ id: 'A', interactive: true, declared: 'solo', result: null }, { id: 'B', interactive: true, declared: 'solo', result: DISSIPE }]);
    expect(boutons()).toEqual(['Contre-sort [fermé]', 'Chance : +1 DR ×2', 'Pacte', 'Appliquer']);
    expect(raisonDe('A')).toBe('Déjà dissipé par Bert');
  });

  it('dissipé par un autre, rangée ratée : ni Relance, ni +1 DR, ni Pacte, ni Résilience ; le dissipateur garde les siens', () => {
    monterContreSort([{ id: 'A', interactive: true, declared: 'solo', result: RATE }, { id: 'B', interactive: true, declared: 'solo', result: DISSIPE }]);
    expect(boutons()).toEqual(['Chance : +1 DR ×2', 'Pacte', 'Appliquer (dissipé)']);
  });
});

describe('Opposition de la cible — la ligne annoncée est celle que la cible roule', () => {
  it('Fauche-démon, cible Exténuée : « Force Mentale », base 40, puce Exténué −10, cible 30', () => {
    const A = mk('A', 'Anna', 'heros', { conditions: [{ id: 'extenue', value: 1 }] as never });
    const pc = { casterId: 'E', targetId: 'A', spellId: 'fauche-demon', missile: false, focused: false, result: ENEMY_CAST } as never as PendingCast;
    poser([mk('E', 'Ennemi', 'ennemi'), A], pc);
    act(() => { openCastOpposition(useGame.getState, useGame.setState, pc, [A]); });
    act(() => { root.render(<CastModal />); });
    const zones = host.querySelectorAll('.cs-rows');
    const zone = zones[zones.length - 1];
    const texte = (zone.textContent ?? '').replace(/\s+/g, ' ');
    expect(texte).toContain('la cible oppose son Force Mentale');
    expect(texte).toContain('Exténué');
    expect(texte).toContain('−10');
    expect(texte).toContain('30 à lancer');
  });
});
