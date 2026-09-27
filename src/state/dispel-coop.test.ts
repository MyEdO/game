/**
 * L'ÉLECTION DU PORTEUR EST UN CHOIX D'ÉCRAN — elle se joue chez l'ÉMETTEUR (#1411).
 *
 * Mode Dissiper (LDB 46 l.158-162), spec HUD §1d : le clic-token élit le PORTEUR, il reste à choisir
 * LEQUEL de ses Sorts dissiper — c'est le panneau-paramètre de la console qui le demande. Rien n'est
 * engagé par cette élection : elle vit à la racine du store (`dispelCarrierId`), hors `battle`, et le
 * snapshot de l'hôte l'efface (`netFlow.netSnapshot`).
 *
 * Le défaut mesuré : `battleClickEntity` est un intent d'allowlist, donc chez l'invité il partait à
 * l'hôte, qui exécutait `dispelSelectCarrier` DANS SON PROPRE STORE — un panneau étranger s'ouvrait
 * chez l'hôte, et l'invité n'en voyait jamais aucun (son élection n'existait nulle part).
 *
 * La couture est celle, déjà écrite, du verdict d'armement (`localIntent.argsAvecVerdictLocal`) : ce
 * qui est un mode d'écran se calcule et se JOUE chez l'émetteur. Ici le mode de ciblage DÉCLARE que
 * son clic n'est qu'une élection (`TargetingMode.electionLocale`), et `emettreIntentInvite` la joue
 * en local au lieu d'émettre. Seul le COMMIT (`battleDispelSpell`, allowlisté) voyage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emettreIntentInvite, interceptGuestActions, restoreGuestActions, netSnapshot, initialNet } from './netFlow';
import { intentEluLocalement } from './targetingModes';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import type { ActiveEffect } from '../engine/types';

const get = () => useGame.getState();

const arena = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

/**
 * TABLE À DEUX SIÈGES, état RÉEL : deux héros (un par siège), deux ennemis porteurs de Sorts.
 * L'ACTIF (`h1`) appartient au siège de CE client, `h2` à l'autre : la possession est donc VRAIE —
 * `controlsCombatant` ouvre le clic ici, et le refuserait sur le héros du voisin. Jamais un combat vide.
 */
function table(mode: 'host' | 'guest', porteurs: Record<string, number>) {
  const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
  hero.skills.push({ id: 'langue', spec: 'magick', advances: 0 } as never);
  const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
  const e1 = spawnEnemy({ ref: 'capitaine-du-guet' }, 'e1', { x: 7, y: 6 });
  const e2 = spawnEnemy({ ref: 'capitaine-du-guet' }, 'e2', { x: 8, y: 6 });
  // Porteurs de Sorts à la forme RÉELLE d'un effet actif (`bonus`/`duration` REQUIS,
  // `engine/types.ts`) : un effet sans durée ne peut pas exister en jeu — le peintre de pastilles
  // jette dessus (`gameIso/effectIcons.ts` lit `e.duration.scale`). Le type le GARDE ici.
  for (const c of [e1, e2]) {
    const n = porteurs[c.id] ?? 0;
    c.activeEffects = Array.from({ length: n }, (_, i): ActiveEffect => ({
      label: `Effet ${i + 1}`,
      bonus: 0,
      duration: { scale: 'permanent' },
      spell: { spellId: `sort-${i + 1}`, casterId: 'e2', label: `Sort ${i + 1}`, ni: 3 + i },
    }));
  }
  const battle = {
    combatants: [hero, ally, e1, e2], order: ['h1', 'h2', 'e1', 'e2'], baseOrder: ['h1', 'h2', 'e1', 'e2'],
    turn: 0, round: 1, action: 'dispel', selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  useGame.setState({
    battle, scene: arena(), party: [hero, ally],
    pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null,
    pendingSiegeAim: null, pendingDispel: null, dispelCarrierId: null,
    net: {
      ...initialNet(), mode,
      mySeat: mode === 'guest' ? 1 : 0,
      ownership: mode === 'guest' ? { h1: 1, h2: 0 } : { h1: 0, h2: 1 },
      seatNames: { 0: 'Hôte', 1: 'Invité' },
    },
  });
  return { hero, ally, e1, e2 };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], pendingDispel: null, pendingAttack: null, dispelCarrierId: null, net: initialNet() });
});
afterEach(() => {
  restoreGuestActions();
  useGame.setState({ net: initialNet() });
});

describe('Dissipation en coop — l’élection du porteur ne voyage JAMAIS', () => {
  it('INVITÉ, porteur à 2 Sorts : le panneau naît CHEZ LUI et rien ne part sur le fil', () => {
    table('guest', { e1: 2 });
    const local = get().battleClickEntity;
    const envoyer = vi.fn();
    emettreIntentInvite('battleClickEntity', local as never, envoyer, ['e1']);
    expect(get().dispelCarrierId, 'l’élection n’a pas eu lieu dans le store de l’ÉMETTEUR : aucun panneau à l’écran').toBe('e1');
    expect(envoyer, 'l’élection est partie chez l’hôte : le panneau s’y ouvrirait, jamais chez l’invité').not.toHaveBeenCalled();
    expect(get().pendingDispel, 'rien n’est engagé tant que le Sort n’est pas choisi').toBeNull();
  });

  it('INVITÉ, porteur à 1 Sort : rien à élire — le GESTE part à l’hôte (c’est un acte de jeu)', () => {
    table('guest', { e1: 1 });
    const local = get().battleClickEntity;
    const envoyer = vi.fn();
    emettreIntentInvite('battleClickEntity', local as never, envoyer, ['e1']);
    expect(get().dispelCarrierId, 'aucun paramètre à demander : rien ne doit être élu').toBeNull();
    expect(get().pendingDispel, 'le commit s’est joué EN LOCAL chez l’invité — il sera écrasé au snapshot').toBeNull();
    expect(envoyer, 'le geste de jeu doit VOYAGER').toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0][0]).toBe('battleClickEntity');
    expect(envoyer.mock.calls[0][1]).toEqual(['e1', { approche: false }]);
  });

  it('CÂBLAGE : le substitut RÉELLEMENT posé par `interceptGuestActions` fait le même partage', () => {
    // Pas de session (pas de relay) : `guest` est nul, donc la branche « envoyer » ne fait RIEN.
    // C'est ce qui rend le partage visible sur l'arbre réel — l'élection agit, le geste de jeu non.
    table('guest', { e1: 2, e2: 1 });
    interceptGuestActions();
    try {
      get().battleClickEntity('e1'); // 2 Sorts → élection LOCALE
      expect(get().dispelCarrierId, 'le substitut d’invité n’a pas joué l’élection en local').toBe('e1');
      get().dispelSelectCarrier(null);
      get().battleClickEntity('e2'); // 1 Sort → geste de jeu, parti au réseau (donc inerte ici)
      expect(get().dispelCarrierId).toBeNull();
      expect(get().pendingDispel, 'le commit a été joué en local au lieu de partir en intent').toBeNull();
    } finally {
      restoreGuestActions();
    }
  });

  it('le porteur élu est ABSENT du snapshot (l’élection d’un joueur ne regarde pas les autres)', () => {
    table('host', { e1: 2 });
    get().dispelSelectCarrier('e1');
    expect(get().dispelCarrierId, 'témoin : l’élection est bien posée avant la mesure').toBe('e1');
    expect('dispelCarrierId' in netSnapshot(get), 'le porteur élu de l’hôte part chez ses invités').toBe(false);
  });

  it('HÔTE : le même clic élit chez lui aussi — l’élection locale n’est pas une branche « invité »', () => {
    table('host', { e1: 2 });
    get().battleClickEntity('e1');
    expect(get().dispelCarrierId).toBe('e1');
    expect(intentEluLocalement(get, 'battleClickEntity', ['e1']), 'le verdict d’élection se lit au MODE, quel que soit le siège').toBe(true);
  });

  it('hors mode Dissiper, un clic-token reste un GESTE DE JEU (aucune élection ne se réclame)', () => {
    table('guest', { e1: 2 });
    useGame.setState({ battle: { ...get().battle!, action: null } });
    expect(intentEluLocalement(get, 'battleClickEntity', ['e1'])).toBe(false);
    expect(intentEluLocalement(get, 'battleEndTurn', []), 'un intent hors table voyage inchangé').toBe(false);
  });
});
