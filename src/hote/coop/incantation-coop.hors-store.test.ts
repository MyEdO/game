/**
 * LA FENÊTRE D'INCANTATION EN COOP (#3059), sur transport en mémoire (`FakeTransport`) : l'invité du siège 1 incante
 * avec SON héros chez l'hôte (`appliquerLIntentionDUnSiege`). Les deux côtés lisent la même `fenetreDIncantation`, au
 * masque près (les refus qui jugent le siège) ; l'hôte est refusé sur l'Incantation Critique du lanceur de l'invité,
 * l'invité la tranche. LDB 46 l.26-32.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { castSpell } from '../../noyau/combatFlow';
import { testScene } from '../../scenes/test-fixture';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { fenetreDIncantation, type FenetreDIncantation } from '../../noyau/fenetreDIncantation';
import { etatInitialDuJeu, type NetState } from '../../noyau/etat';
import { herosDeScenario } from '../../scenes/test-scenarios/_heros';
import type { Combatant } from '../../engine/types';

const NET = (mode: 'hote' | 'invite', mySeat: number, invite: string): NetState => ({
  mode, mySeat, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { [invite]: 1 }, slots: [1, 1, 0, 0], rangs: {},
});

/** Un sorcier en Langue (Magick) 60 : le dé 11 est un double réussi. */
function sorcier(id: string): Combatant {
  const h = herosDeScenario(idsDeTest, 'sorcier');
  h.id = id; h.label = id;
  h.spells = ['arme-aethyrique'];
  h.skills = [...h.skills.filter((s) => s.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 }] as typeof h.skills;
  return h;
}

/** La fenêtre sans ce qui juge le siège qui la lit : les refus, les fermetures du flux, l'annulation. */
function auMasque(v: FenetreDIncantation | null): unknown {
  return JSON.parse(JSON.stringify(v, (k, x) => (/^refus|^fermetures$|^annulation$/.test(k) ? undefined : x)));
}

describe('Incantation en coop : la même fenêtre des deux côtés, le choix au siège du lanceur', () => {
  it('l’invité lance l’Arme aethyrique de son héros au Critique ; l’hôte lit la même fenêtre et ne tranche pas son effet', () => {
    const H = sorcier('H');
    const L = sorcier('L');
    const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [H, L], net: NET('hote', 0, L.id) } });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const lanceurEnCombat = banc.getState().battle!.combatants.find((c) => c.id === L.id)!;
    const recus: Record<string, unknown>[] = [];
    const host = new HostSession({
      build: 'test',
      applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(banc.getState, seat, action, args); },
      getSnapshot: () => instantaneDeLaCoop(banc.getState()),
    });
    const [a, b] = FakeTransport.pair();
    const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (d) => { recus.push(d); } });
    host.addGuest(a, 1);
    guest.connect(b);
    castSpell(banc.getState, banc.setState, lanceurEnCombat, lanceurEnCombat, 'arme-aethyrique');
    expect(banc.getState().pendingCast, 'chemin : l’incantation du héros de l’invité s’ouvre chez l’hôte').toMatchObject({ casterId: L.id, result: null });
    guest.sendIntent('jetLancer', ['incantation']);
    guest.sendIntent('jetImposerLeResultat', ['incantation', 11]);
    expect(banc.getState().pendingCast!.result, 'chemin : le jet de l’invité est tombé chez l’hôte, au Critique').toMatchObject({ isCritical: true });
    host.broadcastSnapshot();
    const chezLInvite = appliquerLInstantane(recus[recus.length - 1], { ...etatInitialDuJeu(), net: NET('invite', 1, L.id) }).etat;
    const vueHote = fenetreDIncantation(banc.getState());
    // Le lecteur est pur : l'état de l'invité, sous les actions du banc, qu'il ne lit pas.
    const vueInvite = fenetreDIncantation({ ...banc.getState(), ...chezLInvite });
    expect(auMasque(vueInvite)).toEqual(auMasque(vueHote));
    const puissance = (v: FenetreDIncantation | null) => v?.critique?.options.find((o) => o.valeur === 'puissance')?.refus ?? null;
    expect(puissance(vueHote), 'chez l’hôte, l’effet du lanceur de l’invité est refusé').toBeTruthy();
    expect(puissance(vueInvite), 'chez l’invité, il est offert').toBeNull();
    banc.getState().jetRegler('incantation', 'effetCritique', 'puissance');
    expect(banc.getState().pendingCast!.critChoice, 'l’hôte ne tranche pas l’effet du lanceur de l’invité').toBeUndefined();
    guest.sendIntent('jetRegler', ['incantation', 'effetCritique', 'puissance']);
    expect(banc.getState().pendingCast!.critChoice).toBe('puissance');
  });
});
