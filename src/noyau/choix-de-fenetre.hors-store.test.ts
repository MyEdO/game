/**
 * LE CHOIX D'UNE FENÊTRE (#3369) : `fenetreChoisir(fenetre, axe, valeur)` joue le corps que `CorpsDesChoix` donne à
 * l'axe, parmi les valeurs que l'état lui ouvre (`OUVERTS_DU_CHOIX`), et refuse le reste en le disant ; en coop, il suit
 * le siège que sa déclaration nomme (`CHOIX_DES_FENETRES`, `netOwnership.ROUTES`) : l'hôte seul, ou le propriétaire de
 * la fenêtre nommée, jamais celui de la modale qui tient la main.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { siegeDe } from './sieges';
import type { ArgumentsDuChoix } from './choixDesFenetres';
import { pregenParty, PREGEN } from '../data/pregens';
import { t } from '../i18n';

/** Coop : l'hôte (siège 0) et un invité (siège 1), un héros chacun. */
function hoteEtUnInvite(banc: Banc): { a: string; b: string } {
  const [a, b] = pregenParty(PREGEN.soldat, PREGEN.tueur);
  banc.setState({ party: [a, b], net: { ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { [a.id]: 0, [b.id]: 1 }, slots: [1, 1, 0, 0] } });
  return { a: a.id, b: b.id };
}

/** Chaque choix que l'hôte seul joue, l'état qui ouvre sa fenêtre, et le champ qui reste tant qu'il ne se joue pas. */
const CHOIX_DE_L_HOTE: readonly (readonly [string, ArgumentsDuChoix, Record<string, unknown>])[] = [
  ['council', ['council', 'paie', 'pas-de-paie'], { pendingCouncil: { today: 7, wageBrass: 240, phase: 'choix' } }],
  ['manannPriest', ['manannPriest', 'payer', false], { pendingManannPriest: { cost: { gold: 3, silver: 0, brass: 0 } } }],
  ['shoreLeave', ['shoreLeave', 'accorder', true], { pendingShoreLeave: { to: { id: 'B', label: 'B' } } }],
];

describe('fenetreChoisir', () => {
  it('un choix que la fenêtre ne déclare pas, une fenêtre fermée, une valeur que l’état n’ouvre pas : refusés et dits', () => {
    const banc = ouvrirLeBanc();
    banc.getState().fenetreChoisir(...(['cascade', 'abandon', true] as unknown as ArgumentsDuChoix));
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.inconnu'));
    banc.getState().fenetreChoisir('renounce', 'renier', true);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.fermee'));
    const { a } = hoteEtUnInvite(banc);
    banc.setState({ pendingFateSave: { heroId: a, source: 'slow' } as never });
    banc.getState().fenetreChoisir('fateSave', 'issue', 'negate');
    expect(banc.getState().journal.slice(-1)[0], 'une mort lente ne s’évite pas (LDB 17 l.31)').toBe(t('choix.refus.valeur'));
    expect(banc.getState().pendingFateSave, 'la fenêtre reste ouverte').not.toBeNull();
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreChoisir', ['fateSave', 'inconnu', 'negate']), 'axe inconnu : aucun siège').toBe(false);
  });

  it.each(CHOIX_DE_L_HOTE)('le choix de l’hôte reste à l’hôte (%s) : refusé dans l’état d’un invité, et au siège d’un invité', (_fenetre, args, ouverte) => {
    const banc = ouvrirLeBanc();
    hoteEtUnInvite(banc);
    banc.setState({ ...ouverte, net: { ...banc.getState().net, mode: 'guest' } } as never);
    const avant = banc.getState();
    banc.getState().fenetreChoisir(...args);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('choix.refus.hoteSeul'));
    for (const cle of Object.keys(ouverte)) expect((banc.getState() as unknown as Record<string, unknown>)[cle], 'la fenêtre reste ouverte').toBe((avant as unknown as Record<string, unknown>)[cle]);

    banc.setState({ net: { ...banc.getState().net, mode: 'host' } });
    expect(intentAllowedFor(banc.getState(), 1, 'fenetreChoisir', args), 'au siège d’un invité').toBe(false);
    expect(intentAllowedFor(banc.getState(), 0, 'fenetreChoisir', args), 'au siège de l’hôte').toBe(true);
  });

  it('le choix du propriétaire suit son siège : une seule modale ouverte, le même siège que celui de la modale', () => {
    const banc = ouvrirLeBanc();
    const { b } = hoteEtUnInvite(banc);
    const ouvertes: readonly (readonly [Record<string, unknown>, ArgumentsDuChoix])[] = [
      [{ pendingFateSave: { heroId: b, source: 'slow' } }, ['fateSave', 'issue', 'survive']],
      [{ pendingRenounce: { heroId: b, testRoll: 90, testTarget: 30 } }, ['renounce', 'renier', false]],
      [{ battle: { order: [b], turn: 0, combatants: [] }, pendingMountTarget: { riderId: 'r', mountId: 'm' } }, ['mountTarget', 'cible', 'r']],
    ];
    for (const [etat, args] of ouvertes) {
      banc.setState({ pendingFateSave: null, pendingRenounce: null, pendingMountTarget: null, battle: null, ...etat } as never);
      const s = banc.getState();
      expect(siegeDe(s, modalOwnerOf(s) as string), `${args[0]} : la modale est à l’invité`).toBe(1);
      expect([0, 1].filter((siege) => intentAllowedFor(s, siege, 'fenetreChoisir', args)), `${args[0]} : le choix aussi`).toEqual([1]);
    }
  });

  it('deux fenêtres ouvertes : le choix suit le propriétaire de la fenêtre qu’il nomme, pas la modale qui tient la main', () => {
    const banc = ouvrirLeBanc();
    const { a, b } = hoteEtUnInvite(banc);
    banc.setState({ pendingFateSave: { heroId: b, source: 'slow' }, pendingRenounce: { heroId: a, testRoll: 90, testTarget: 30 } } as never);
    const s = banc.getState();
    expect(siegeDe(s, modalOwnerOf(s) as string), 'le Destin, à l’invité, tient la main').toBe(1);
    expect([0, 1].filter((siege) => intentAllowedFor(s, siege, 'fenetreChoisir', ['renounce', 'renier', true])), 'la mutation se renie au siège de son héros').toEqual([0]);
    expect([0, 1].filter((siege) => intentAllowedFor(s, siege, 'fenetreChoisir', ['fateSave', 'issue', 'survive'])), 'le Destin, au siège du sien').toEqual([1]);
  });
});
