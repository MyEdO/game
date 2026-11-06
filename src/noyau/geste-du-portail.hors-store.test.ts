/**
 * LE GESTE D'UN ACCÈS (`gesteDuPortail`) : la porte fermée s'actionne, l'accès ouvert se franchit en marchant vers sa case
 * d'en face, la marche fermée (dialogue) n'ouvre aucun geste. Les gestes d'exploration (`gestesDExploration`) le lisent ;
 * l'activation de l'écran aussi (`gameIso/stage/useStagePointer.ts`, `activatePortal`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { emptyScene, type Dialogue, type Scene } from './monde/scene';
import type { RoomPortal } from './monde/roomPortals';
import { aretesUtilisables } from './aretes';
import { computeStateVisible } from './visionState';
import { gesteDuPortail } from './marcheDuGroupe';
import { gestesDExploration } from './gestesDExploration';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();

/** Le groupe dans la pièce (1,1) : porte fermée au N, porte ouverte à l'E. */
function couloir(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  s.effectZones = [{ id: 'piece', label: 'Pièce', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 } }];
  s.walls = [{ x: 1, y: 1, side: 'N', door: true, closed: true }, { x: 1, y: 1, side: 'E', door: true }];
  return s;
}

function enExploration(): { fermee: RoomPortal; ouverte: RoomPortal } {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [h], battle: null, journal: [] });
  g().startScene(couloir());
  banc.setState({ partyPos: { x: 1, y: 1 } });
  const s = g();
  const portails = aretesUtilisables({ scene: s.scene!, visible: computeStateVisible(s), controleur: s.partyPos, activeZ: 0 }).flatMap((a) => (a.portail ? [a.portail] : []));
  const fermee = portails.find((p) => p.edge.side === 'N' && p.edge.x === 1 && p.edge.y === 1);
  const ouverte = portails.find((p) => p.edge.side === 'E' && p.edge.x === 1 && p.edge.y === 1);
  if (!fermee || !ouverte) throw new Error(`la scène ne borde pas ses deux portes : ${JSON.stringify(portails)}`);
  return { fermee, ouverte };
}

const DIALOGUE: Dialogue = { id: 'd', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [{ id: 'adieu', label: 'Adieu' }] }] } as Dialogue;

describe('le geste d’un accès : une source pour le noyau et l’écran', () => {
  it('la porte fermée s’actionne, l’accès ouvert se franchit en marchant vers sa case d’en face', () => {
    const { fermee, ouverte } = enExploration();
    expect(fermee.kind).toBe('door-closed');
    expect(ouverte.kind).toBe('door-open');
    expect(gesteDuPortail(g(), fermee)).toEqual({ verbe: 'actionnerLaPorte', args: [fermee.id] });
    expect(gesteDuPortail(g(), ouverte)).toEqual({ verbe: 'cliquerLaCase', args: [ouverte.to] });
  });

  it('les gestes d’exploration offrent exactement ces deux gestes pour les deux portes', () => {
    const { fermee, ouverte } = enExploration();
    const gestes = gestesDExploration(g()).flatMap((x) => x.gestes);
    expect(gestes).toContainEqual({ verbe: 'actionnerLaPorte', args: [fermee.id] });
    expect(gestes).toContainEqual({ verbe: 'cliquerLaCase', args: [ouverte.to] });
  });

  it('en dialogue la marche est fermée : aucun geste d’accès, ni au lecteur ni aux gestes d’exploration', () => {
    const { fermee, ouverte } = enExploration();
    banc.setState({ dialogue: { dialogue: DIALOGUE, nodeId: 'n', session: 1 } });
    expect(gesteDuPortail(g(), fermee)).toBeNull();
    expect(gesteDuPortail(g(), ouverte)).toBeNull();
    const verbes = gestesDExploration(g()).flatMap((x) => x.gestes.map((y) => y.verbe));
    expect(verbes.filter((v) => v === 'actionnerLaPorte' || v === 'cliquerLaCase')).toEqual([]);
  });
});
