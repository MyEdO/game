/**
 * LE VERBE VALIDE (#1869 correctif 1), côté web : le `when` de la touche `dialogue-reponse-N` dit la MÊME chose que le
 * verbe (`conversationRepond`, prédicat unique). Les gardes du verbe le choix `dialogue.reponse` se jouent au banc du noyau
 * (`src/noyau/dialogue-verbe-garde.hors-store.test.ts`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { KEYBINDINGS } from './clavier/keybindings';
import { conversationRepond } from '../noyau/dialogue';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import type { Combatant } from '../engine/types';
import type { Dialogue } from '../noyau/monde/scene';
import type { GameState } from './store';

const hero = (brass = 0): Combatant =>
  withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }), { gold: 0, silver: 0, brass }, idsDeTest);

/** Un nœud, trois réponses : un Test, une MASQUÉE par son `when`, une PAYANTE hors de portée. */
const dlg: Dialogue = {
  id: 'd-garde', start: { id: 'n1' },
  nodes: [
    { id: 'n1', desc: '…', choices: [
      { id: 'tenter', label: 'Tenter', next: { id: 'n2' }, flow: { kind: 'test', test: { characteristic: 'force', label: 'Force' }, reussite: { kind: 'sequence', etapes: [] }, echec: { kind: 'sequence', etapes: [] } } },
      { id: 'secret', label: 'Secret', next: { id: 'n2' }, when: { kind: 'flag', expr: 'jamais' } },
      { id: 'acheter', label: 'Acheter', next: { id: 'n2' }, cost: { gold: 5 } },
    ] },
    { id: 'n2', desc: 'Suite', choices: [] },
  ],
} as Dialogue;

const touche = (n: number) => KEYBINDINGS.find((k) => k.id === `dialogue-reponse-${n}`)!;

function monter(over: Partial<GameState> = {}) {
  useGame.setState({
    screen: 'campaign', battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingTest: null,
    party: [hero(12)], dialogueHistory: [],
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    ...over,
  } as Partial<GameState>);
}

beforeEach(() => monter());

describe('dialogue.reponse — la fenêtre de jet SUSPEND la conversation', () => {
  it('la TOUCHE dit la même chose que le verbe : fermée sous la modale, ouverte sans elle', () => {
    expect(touche(1).when(useGame.getState())).toBe(true);
    useGame.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    expect(touche(1).when(useGame.getState()), 'la fenêtre de jet tient la main : la touche se tait').toBe(false);
    expect(conversationRepond(useGame.getState())).toBe(false);
  });
});
