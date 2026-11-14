/**
 * Le clic d'EXPLORATION joué (`cliquerLaCase`, `interactionsDExploration.ts`) : contrat déclaré d'
 * `IntentionDExploration`. `rejoindre` pose le pending puis marche ; `dire` écrit au journal ; `annuler` (la case du
 * groupe) abandonne le pending ; toute variante hors `rejoindre` pose d'abord `poserLInteraction(null)`.
 * Scènes FABRIQUÉES.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { emptyScene, type SceneEntity } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { t } from '../i18n';
import { cleActionJouee } from './monde/usable';
import { ficheDEntite } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const coffre: SceneEntity = {
  id: 'coffre', kind: 'prop', pos: { x: 9, y: 6 }, label: 'Coffre bardé de fer',
  usable: { actions: [{ id: 'fouiller', flow: { kind: 'sequence', etapes: [] }, unique: true }] },
} as SceneEntity;
const figurant: SceneEntity = { id: 'fig', kind: 'personnage', pos: { x: 5, y: 5 }, label: 'Badaud', creature: { id: 'humain' } } as SceneEntity;

function poser(entities: SceneEntity[], partyPos = { x: 5, y: 6 }) {
  const sc = emptyScene('scene-clic', 12, 12);
  sc.entities = entities;
  const heros = combattantDeTest({ id: 'h', label: 'H', kind: 'heros', movement: 4 });
  banc.setState({ scene: sc, mode: 'exploration', partyPos, party: [heros], dialogue: null, flags: {}, pendingInteract: null } as never);
}

describe('cliquerLaCase — intentions d’exploration jouées', () => {
  it('rejoindre : une entité utilisable hors de portée arme son offre unique ; le groupe marche, et l’offre se joue à l’arrivée', () => {
    poser([coffre]);
    let arme: unknown = null;
    const off = banc.subscribe((e, prev) => { if (e.pendingInteract && !prev.pendingInteract) arme = e.pendingInteract; });
    try {
      banc.getState().cliquerLaCase(coffre.pos, coffre.id);
    } finally {
      off();
    }
    expect(arme).toMatchObject({ id: 'coffre', actionId: 'fouiller' });
    expect(banc.getState().partyPos).toMatchObject((arme as { at: object }).at);
    expect(banc.getState().pendingInteract).toBeNull();
    expect(banc.getState().flags[cleActionJouee('coffre', 'fouiller')]).toBe(true);
  });

  it('dire : un figurant à portée ne parle pas, le journal le dit, le pending tombe', () => {
    poser([figurant]);
    banc.setState({ pendingInteract: { id: 'autre', at: { x: 0, y: 0 } } } as never);
    banc.getState().cliquerLaCase(figurant.pos, figurant.id);
    const who = ficheDEntite(figurant, presetDuNarratif(banc.getState().campaignNarratif)).label;
    expect(banc.getState().journal[banc.getState().journal.length - 1]).toBe(t('exploration.figurantMuet', { who }));
    expect(banc.getState().pendingInteract).toBeNull();
  });

  it('annuler : la case du groupe abandonne le pending, sans pas ni ligne au journal', () => {
    poser([]);
    banc.setState({ pendingInteract: { id: 'autre', at: { x: 0, y: 0 } } } as never);
    const journal = banc.getState().journal;
    banc.getState().cliquerLaCase({ x: 5, y: 6 });
    expect(banc.getState().pendingInteract).toBeNull();
    expect(banc.getState().partyPos).toMatchObject({ x: 5, y: 6 });
    expect(banc.getState().journal).toBe(journal);
  });
});
