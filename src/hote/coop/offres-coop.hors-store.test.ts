/**
 * LES OFFRES EN COOP (#3371, #3610), sur transport en mémoire (`FakeTransport`) : l'invité du siège 1 joue chez l'hôte
 * le verbe que l'offre déclare (`gesteDeLOffre`), routé comme tout verbe (`terminerLeTour`, `fenetreValider`,
 * `leverLaMain`) ; un verbe joué chez l'hôte dont l'offre arme une intention (`armerLAttaque`) l'arme chez l'émetteur
 * (`preparerLIntentLocal`) ; un sort hors combat se route au propriétaire de son lanceur.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege, type IssueDIntention } from '../../noyau/intentionsDeSiege';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { emettreIntentInvite } from '../../noyau/reseau';
import { activeCombatant } from '../../noyau/combatFlow';
import { gesteDeLOffre, offreDeId } from '../../noyau/actionRegistry';
import { testScene } from '../../scenes/test-fixture';
import type { NetState } from '../../noyau/etat';
import { herosDeScenario } from '../../scenes/test-scenarios/_heros';
import type { Combatant } from '../../engine/types';

const NET: NetState = {
  mode: 'hote', mySeat: 0, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { L: 1 }, slots: [1, 1, 0, 0], rangs: {},
};

/** Un sorcier en Langue (Magick) 60, qui connaît l'Arme aethyrique. */
function sorcier(id: string): Combatant {
  const h = herosDeScenario(idsDeTest, 'sorcier');
  h.id = id; h.label = id;
  h.spells = ['arme-aethyrique'];
  h.skills = [...h.skills.filter((s) => s.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 }] as typeof h.skills;
  return h;
}

/** La table : l'hôte (banc, héros `H`) et l'invité du siège 1 (héros `L`), reliés par transport ; chaque intention
 *  appliquée chez l'hôte rend son issue. */
function table(): { banc: Banc; envoyer: (action: string, args: unknown[]) => IssueDIntention } {
  const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [sorcier('H'), sorcier('L')], net: NET, screen: 'campaign' } });
  const issues: IssueDIntention[] = [];
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { issues.push(appliquerLIntentionDUnSiege(banc.getState, seat, action, args)); },
    getSnapshot: () => instantaneDeLaCoop(banc.getState()),
  });
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: () => {} });
  const [a, b] = FakeTransport.pair();
  host.addGuest(a, 1);
  guest.connect(b);
  return { banc, envoyer: (action, args) => { guest.sendIntent(action, args); return issues[issues.length - 1]; } };
}

/** Le combat ouvert, en pause de Round. */
function enPause(): ReturnType<typeof table> {
  const t = table();
  t.banc.getState().lancerLaScene(testScene());
  t.banc.getState().lancerLeCombat('enc-mutants');
  return t;
}

/** Le combat au tour du héros `id`, Action dépensée. */
function auTourDe(t: ReturnType<typeof table>, id: string): void {
  t.banc.getState().fenetreValider('debutDuRound');
  t.envoyer('fenetreValider', ['debutDuRound']);
  const b = t.banc.getState().battle!;
  t.banc.setState({ battle: { ...b, turn: b.order.indexOf(id), acted: true, action: null }, pendingRoundStart: null });
}

describe('Offres en coop : le verbe de l’offre voyage', () => {
  it('le verbe de `fin-de-tour` de l’invité finit le tour de SON héros ; au tour d’autrui il est refusé', () => {
    const t = enPause();
    auTourDe(t, 'L');
    expect(t.envoyer('terminerLeTour', [])).toBe('appliquee');
    const apres = activeCombatant(t.banc.getState().battle!)?.id;
    expect(apres, 'le tour du héros de l’invité n’a pas fini').not.toBe('L');
    auTourDe(t, 'H');
    expect(t.envoyer('terminerLeTour', []), 'l’invité finissait le tour du héros de l’hôte').toBe('refusee');
    expect(activeCombatant(t.banc.getState().battle!)?.id).toBe('H');
  });

  it('`armerLAttaque` se joue chez l’hôte : l’intention s’arme chez l’invité, pas chez l’hôte, et le mode revient par l’instantané', () => {
    const t = enPause();
    auTourDe(t, 'L');
    t.banc.setState({ battle: { ...t.banc.getState().battle!, acted: false, selectedAttack: 'autre' } });
    // Un seul jeu se branche par test : le banc joue l'invité sur l'instantané de l'hôte, puis l'hôte reprend sa place.
    const hote = { ...t.banc.getState() };
    t.banc.setState(appliquerLInstantane(instantaneDeLaCoop(hote), { ...hote, net: { ...NET, mode: 'invite', mySeat: 1 } }).etat);
    const envoyes: [string, unknown[]][] = [];
    emettreIntentInvite(t.banc.getState, 'armerLAttaque', t.banc.getState().armerLAttaque as never, (action, args) => envoyes.push([action, args]), ['arme']);
    const invite = { ...t.banc.getState() };
    expect(envoyes).toEqual([['armerLAttaque', ['arme']]]);
    expect(invite.localIntent?.actionId, 'l’intention n’est pas armée chez l’invité').toBe('attaque');
    expect(invite.battle!.selectedAttack, 'le corps s’est joué chez l’invité').toBe('autre');

    t.banc.setState(hote);
    expect(t.envoyer(...envoyes[0])).toBe('appliquee');
    expect(t.banc.getState().localIntent ?? null, 'l’hôte a armé l’intention d’autrui').toBeNull();
    expect(t.banc.getState().battle!.selectedAttack, 'le corps ne s’est pas joué chez l’hôte').toBe('arme');

    const recu = appliquerLInstantane(instantaneDeLaCoop(t.banc.getState()), invite).etat;
    expect(recu.battle!.selectedAttack, 'le mode n’est pas revenu par l’instantané').toBe('arme');
    expect(recu.localIntent?.actionId, 'l’instantané a écrasé l’intention locale').toBe('attaque');
  });

  it('`debut-de-round` déclare `fenetreValider` : son verbe marque le siège prêt', () => {
    const t = enPause();
    expect(t.banc.getState().pendingRoundStart, 'témoin : la pause de Round est ouverte').toBeTruthy();
    expect(gesteDeLOffre(t.banc.getState(), offreDeId('debut-de-round')!)).toEqual({ verbe: 'fenetreValider', args: ['debutDuRound'] });
    expect(t.banc.getState().pendingRoundStart!.readyBySeat?.[1] ?? false).toBe(false);
    expect(t.envoyer('fenetreValider', ['debutDuRound'])).toBe('appliquee');
    expect(t.banc.getState().pendingRoundStart!.readyBySeat?.[1]).toBe(true);
  });

  it('`pause` déclare `leverLaMain` : son verbe lève la main du siège 1, hors de son tour', () => {
    const t = enPause();
    auTourDe(t, 'H');
    expect(gesteDeLOffre(t.banc.getState(), offreDeId('pause')!)).toEqual({ verbe: 'leverLaMain', args: [true] });
    expect(t.envoyer('leverLaMain', [true])).toBe('appliquee');
    expect(t.banc.getState().battle!.handRaisedBy).toEqual([1]);
  });
});

describe('Sort hors combat en coop : le geste se route au propriétaire du lanceur', () => {
  it('l’invité incante avec SON héros ; avec le héros de l’hôte il est refusé', () => {
    const t = table();
    t.banc.getState().lancerLaScene(testScene());
    expect(t.envoyer('incanterLeSort', ['H', 'arme-aethyrique', 'H']), 'l’invité incantait pour le héros de l’hôte').toBe('refusee');
    expect(t.banc.getState().pendingCast ?? null).toBeNull();
    expect(t.envoyer('incanterLeSort', ['L', 'arme-aethyrique', 'L'])).toBe('appliquee');
    expect(t.banc.getState().pendingCast).toMatchObject({ casterId: 'L' });
  });
});
