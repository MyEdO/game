// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as relations from '../engine/relations';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import type { BattleState } from '../noyau/etat';
import { emptyScene } from '../noyau/monde/scene';
import { useGame } from '../state/store';
import { buildTokens } from '../gameIso/builders/tokens';
import { teamRings } from '../gameIso/builders/dynamicMarks';
import { ENEMY_RING, HERO_RING, OUT_OF_PARTY_RING, teamShape } from '../gameIso/teamColors';
import { demonterRacines, monterRacine } from '../monterRacine.testkit';
import { CharFrame } from './CharFrame';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
const initial = useGame.getState();
afterEach(() => {
  demonterRacines();
  vi.restoreAllMocks();
  useGame.setState(initial, true);
});

function heros(id: string): Combatant {
  return { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, seed: 3 }), id, pos: { x: 1, y: 1 } };
}

describe('CharFrame — identité du repère de sol', () => {
  it('le camp de la tuile et du repère vient de campOf, même si le kind dit autre chose', () => {
    const c = { ...heros('camp-resolu'), kind: 'enemy' as const };
    vi.spyOn(relations, 'campOf').mockReturnValue('party');
    useGame.setState({ mode: 'exploration', party: [c], viewMode: 'iso' });
    const { container } = monterRacine(<CharFrame c={c} />);
    expect(container.querySelector('.ptile')!.classList.contains('team-ally')).toBe(true);
    expect(container.querySelector<HTMLElement>('.ptile-wrap')!.style.getPropertyValue('--ptile-ring')).toBe(HERO_RING[0]);
    expect(container.querySelector('.ptile-ring circle')!.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('le membre du groupe au rang 2 porte HERO_RING[1] au sol et dans CharFrame malgré l’ordre du combat', () => {
    const premier = heros('premier');
    premier.pos = undefined;
    const second = heros('second');
    const party = [premier, second];
    const battle = { combatants: [second, premier] } as BattleState;
    const scene = emptyScene('identite', 4, 4);
    const tokens = buildTokens(scene, undefined, battle, { activeZ: 0, viewZ: null, top: false }, party.map((h) => h.id));
    const ring = teamRings(tokens, null).find((r) => r.id === second.id)!;
    expect(ring.color).toBe(HERO_RING[1]);
    useGame.setState({ mode: 'battle', battle, party, viewMode: 'iso' });
    const { container } = monterRacine(<CharFrame c={second} />);
    expect(container.querySelector<HTMLElement>('.ptile-wrap')!.style.getPropertyValue('--ptile-ring')).toBe(ring.color);
    expect(container.querySelector('.ptile-name')!.textContent).toBe(second.label);
  });

  it.each([false, true])('la monture reprend le repère effectivement affiché, vue du dessus : %s', (top) => {
    const cavalier = { ...heros('cavalier'), mountId: 'monture' };
    const monture = { ...heros('monture'), kind: 'enemy' as const, riderId: cavalier.id };
    const premier = heros('premier');
    const party = [premier, cavalier];
    const battle = { combatants: [monture, cavalier, premier] } as BattleState;
    const tokens = buildTokens(emptyScene('monture', 4, 4), undefined, battle, { activeZ: 0, viewZ: null, top }, party.map((h) => h.id));
    const ring = teamRings(tokens, null).find((r) => r.id === monture.id)!;
    expect(ring.color).toBe(top ? ENEMY_RING : HERO_RING[1]);
    useGame.setState({ mode: 'battle', battle, party, viewMode: top ? 'top' : 'iso' });
    const { container } = monterRacine(<CharFrame c={monture} />);
    expect(container.querySelector<HTMLElement>('.ptile-wrap')!.style.getPropertyValue('--ptile-ring')).toBe(ring.color);
    expect(container.querySelector('.ptile-ring circle')!.getAttribute('stroke-dasharray')).toBe(ring.dash ?? null);
  });

  it.each([
    ['allié hors groupe', 'hero', OUT_OF_PARTY_RING],
    ['PNJ', 'npc', OUT_OF_PARTY_RING],
    ['ennemi', 'enemy', ENEMY_RING],
  ] as const)('%s porte son repère de camp au sol et dans CharFrame', (_nom, kind, couleur) => {
    const party = [heros('aventurier')];
    const figurant = { ...heros('figurant'), kind };
    const battle = { combatants: [figurant, ...party] } as BattleState;
    const tokens = buildTokens(emptyScene('camp', 4, 4), undefined, battle, { activeZ: 0, viewZ: null, top: false }, party.map((h) => h.id));
    const ring = teamRings(tokens, null).find((r) => r.id === figurant.id)!;
    expect(ring.color).toBe(couleur);
    expect(ring.dash).toBe(teamShape(relations.campOf(figurant) === 'hostile'));
    useGame.setState({ mode: 'battle', battle, party, viewMode: 'iso' });
    const { container } = monterRacine(<CharFrame c={figurant} />);
    expect(container.querySelector<HTMLElement>('.ptile-wrap')!.style.getPropertyValue('--ptile-ring')).toBe(ring.color);
    expect(container.querySelector('.ptile-ring circle')!.getAttribute('stroke-dasharray')).toBe(ring.dash ?? null);
  });
});
