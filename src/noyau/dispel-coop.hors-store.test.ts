/**
 * L'ÉLECTION DU PORTEUR EST UN CHOIX D'ÉCRAN — elle se joue chez l'ÉMETTEUR (#1411).
 *
 * Mode Dissiper (LDB 46 l.158-162), spec HUD §1d : le clic-token élit le PORTEUR, il reste à choisir
 * LEQUEL de ses Sorts dissiper — c'est le panneau-paramètre de la console qui le demande. Rien n'est
 * engagé par cette élection : elle vit à la racine du store (`dispelCarrierId`), hors `battle`, et le
 * snapshot de l'hôte l'efface (`coop.instantaneDeLaCoop`).
 *
 * Le défaut mesuré : `battleClickEntity` est un intent d'allowlist, donc chez l'invité il partait à
 * l'hôte, qui exécutait `dispelSelectCarrier` DANS SON PROPRE STORE — un panneau étranger s'ouvrait
 * chez l'hôte, et l'invité n'en voyait jamais aucun (son élection n'existait nulle part).
 *
 * La couture est celle, déjà écrite, du verdict d'armement (`localIntent.argsAvecVerdictLocal`) : ce
 * qui est un mode d'écran se calcule et se JOUE chez l'émetteur. Ici le mode de ciblage DÉCLARE que
 * son clic n'est qu'une élection (`TargetingMode.electionLocale`), et `emettreIntentInvite` la joue
 * en local au lieu d'émettre. Seul le COMMIT (`dissiperLeSort`, allowlisté) voyage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { instantaneDeLaCoop } from './coop';
import { intentEluLocalement } from './targetingModes';
import { tableDeDissipation } from './tableDeDissipation.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const table = (mode: 'host' | 'guest', porteurs: Record<string, number>) => banc.setState(tableDeDissipation(mode, porteurs));

describe('Dissipation en coop — l’élection du porteur ne voyage JAMAIS', () => {
  it('le porteur élu est ABSENT du snapshot (l’élection d’un joueur ne regarde pas les autres)', () => {
    table('host', { e1: 2 });
    get().dispelSelectCarrier('e1');
    expect(get().dispelCarrierId, 'témoin : l’élection est bien posée avant la mesure').toBe('e1');
    expect('dispelCarrierId' in instantaneDeLaCoop(get()), 'le porteur élu de l’hôte part chez ses invités').toBe(false);
  });

  it('HÔTE : le même clic élit chez lui aussi — l’élection locale n’est pas une branche « invité »', () => {
    table('host', { e1: 2 });
    get().battleClickEntity('e1');
    expect(get().dispelCarrierId).toBe('e1');
    expect(intentEluLocalement(banc.getState, 'battleClickEntity', ['e1']), 'le verdict d’élection se lit au MODE, quel que soit le siège').toBe(true);
  });

  it('hors mode Dissiper, un clic-token reste un GESTE DE JEU (aucune élection ne se réclame)', () => {
    table('guest', { e1: 2 });
    banc.setState({ battle: { ...get().battle!, action: null } });
    expect(intentEluLocalement(banc.getState, 'battleClickEntity', ['e1'])).toBe(false);
    expect(intentEluLocalement(banc.getState, 'terminerLeTour', []), 'un intent hors table voyage inchangé').toBe(false);
  });
});
