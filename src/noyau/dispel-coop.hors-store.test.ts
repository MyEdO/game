/**
 * L'ÉLECTION DU PORTEUR EST UN CHOIX D'ÉCRAN — elle se joue chez l'ÉMETTEUR (#1411).
 *
 * Mode Dissiper (LDB 46 l.158-162), spec HUD §1d : le clic-token élit le PORTEUR, il reste à choisir
 * LEQUEL de ses Sorts dissiper — c'est le panneau-paramètre de la console qui le demande. Rien n'est
 * engagé par cette élection : elle vit à la racine du store (`dispelCarrierId`), hors `battle`, et le
 * snapshot de l'hôte l'efface (`coop.instantaneDeLaCoop`).
 *
 * Le défaut mesuré : le clic du combattant (`cliquerLaCase`) est un intent d'allowlist, donc chez l'invité il partait à
 * l'hôte, qui exécutait `designerLeSupport` DANS SON PROPRE STORE — un panneau étranger s'ouvrait
 * chez l'hôte, et l'invité n'en voyait jamais aucun (son élection n'existait nulle part).
 *
 * La couture est celle, déjà écrite, de l'intention armée (`localIntent.argsAvecIntentionLocale`) : ce
 * qui est un mode d'écran se calcule et se JOUE chez l'émetteur. Ici le mode de ciblage DÉCLARE que
 * son clic n'est qu'une élection (`TargetingMode.electionLocale`), et `emettreIntentInvite` la joue
 * en local au lieu d'émettre. Seul le COMMIT (`dissiperLeSort`, allowlisté) voyage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { instantaneDeLaCoop } from './coop';
import { intentEluLocalement } from './targetingModes';
import { tableDeDissipation } from './tableDeDissipation.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
/** La case du combattant `id`, que son clic désigne. */
const caseDe = (id: string) => ({ ...get().battle!.combatants.find((c) => c.id === id)!.pos! });
const table = (mode: 'hote' | 'invite', porteurs: Record<string, number>) => banc.setState(tableDeDissipation(mode, porteurs));

describe('Dissipation en coop — l’élection du porteur ne voyage JAMAIS', () => {
  it('le porteur élu est ABSENT du snapshot (l’élection d’un joueur ne regarde pas les autres)', () => {
    table('hote', { e1: 2 });
    get().designerLeSupport('e1');
    expect(get().dispelCarrierId, 'témoin : l’élection est bien posée avant la mesure').toBe('e1');
    expect('dispelCarrierId' in instantaneDeLaCoop(get()), 'le porteur élu de l’hôte part chez ses invités').toBe(false);
  });

  it('HÔTE : le même clic élit chez lui aussi — l’élection locale n’est pas une branche « invité »', () => {
    table('hote', { e1: 2 });
    cliquerSurLeCombattant(get, 'e1');
    expect(get().dispelCarrierId).toBe('e1');
    expect(intentEluLocalement(banc.getState, 'cliquerLaCase', [caseDe('e1'), 'e1']), 'le verdict d’élection se lit au MODE, quel que soit le siège').toBe(true);
  });

  it('hors mode Dissiper, un clic-token reste un GESTE DE JEU (aucune élection ne se réclame)', () => {
    table('invite', { e1: 2 });
    banc.setState({ battle: { ...get().battle!, action: null } });
    expect(intentEluLocalement(banc.getState, 'cliquerLaCase', [caseDe('e1'), 'e1'])).toBe(false);
    expect(intentEluLocalement(banc.getState, 'terminerLeTour', []), 'un intent hors table voyage inchangé').toBe(false);
  });
});
