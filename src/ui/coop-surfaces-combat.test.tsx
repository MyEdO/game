// @vitest-environment jsdom
/**
 * SURFACES COOP DU COMBAT (#1411 P2-A) — deux contrats d'ÉCRAN, mesurés sur le DOM réel :
 *
 *  1. UNE SEULE PUCE DE SPECTATEUR. La bande d'attente de la console et l'arbitre de modales lisent
 *     la MÊME décision (`spectatorSeatOfModal`) ; la console s'y ABONNE, donc une modale distante qui
 *     s'ouvre APRÈS le montage la fait taire — sans abonnement, les deux puces coexistent à l'écran.
 *  2. L'INTERRUPTEUR DE PAUSE de la frise est une surface de COOP : il s'adresse aux autres joueurs.
 *     En partie locale il n'est pas dessiné (comme la rangée de ready-check) ; le refus reste au
 *     registre (`gate: 'coop'`) pour la touche.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

type NetMode = 'local' | 'host' | 'guest';
import { CombatConsole } from './CombatConsole';
import { ActiveModal } from './ActiveModal';
import { CampaignView } from './CampaignView';
import { cascadeDeTest } from '../state/cascadeTestKit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 9 });
  h.id = id;
  h.pos = { x: 5, y: 5 };
  return h;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, pendingCascade: null, mode: 'exploration' });
});

/** Combat coop : le tour est tenu par le héros du siège DISTANT (1) — le siège local est l'hôte (0). */
function combatCoop(mode: NetMode = 'host') {
  const mien = hero('h1', 'Gunnar');
  const sien = hero('h2', 'Wilhelm');
  act(() => {
    useGame.setState({
      party: [mien, sien], scene: testScene(), mode: 'battle', pendingCascade: null,
      net: { ...useGame.getState().net, mode, mySeat: 0, ownership: { h1: 0, h2: 1 }, seatNames: { 0: 'L’hôte', 1: 'Antoine' } },
      battle: {
        combatants: [mien, sien], order: ['h2', 'h1'], baseOrder: ['h2', 'h1'], turn: 0, round: 2,
        action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: false, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  return { mien, sien };
}

const puces = () => document.querySelectorAll('.spectator-chip').length;

describe('coop — UNE puce de spectateur à l’écran, jamais deux', () => {
  it('une modale distante ouverte APRÈS le montage fait taire la bande d’attente de la console', () => {
    combatCoop();
    act(() => { root.render(<><CombatConsole /><ActiveModal /></>); });
    expect(puces(), 'la bande d’attente ne nomme pas le siège qui tient le tour').toBe(1);
    expect(document.querySelector('.spectator-chip')!.getAttribute('data-pose'), 'la bande d’attente de la console suit le FLUX de sa travée').toBeNull();
    // La modale s'ouvre ENSUITE (jet du héros distant) : c'est elle qui parle désormais.
    act(() => {
      useGame.setState({
        pendingCascade: cascadeDeTest([{ id: 's0', kind: 'note', actorId: 'h2', outcome: [] }]),
      });
    });
    expect(puces(), 'deux puces coexistent : la console n’a pas relu la décision').toBe(1);
    expect(document.querySelector('.spectator-chip')!.getAttribute('data-pose'), 'la puce de l’arbitre de modales s’ANCRE à l’écran').toBe('ecran');
  });
});

describe('frise — l’interrupteur de pause de Round est une surface de COOP', () => {
  function monterCampagne(mode: NetMode) {
    combatCoop(mode);
    act(() => { root.render(<CampaignView />); });
    return host.querySelectorAll('.is-hand').length;
  }

  it('partie LOCALE : aucune commande de pause au pied de la frise', () => {
    expect(monterCampagne('local')).toBe(0);
  });

  it('COOP : la commande est dessinée (témoin de la mesure ci-dessus)', () => {
    expect(monterCampagne('host')).toBe(1);
  });
});
