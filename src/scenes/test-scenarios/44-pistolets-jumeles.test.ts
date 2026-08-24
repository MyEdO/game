import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { weaponLoaded } from '../../engine/weaponLoad';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { scenario } from './44-pistolets-jumeles';

/**
 * LE BANC DU PARAMÈTRE BORNÉ — le scénario tient-il sa promesse ? Il ANNONCE deux pistolets vides au
 * poing : c'est ce qui fait naître le geste « Recharger » et son panneau (quelle arme ?). Un
 * chargement d'entrée qui écraserait la donnée authorée le rendrait muet — le scénario ne pourrait
 * plus démontrer son propre objet (mesuré en recette 2026-08-24 : les deux pistolets démarraient
 * PLEINS).
 *
 * Contrat mesuré des DEUX côtés : ce que la scène DÉCLARE tient (armes vides), et le DÉFAUT tient
 * pour ce qui ne déclare rien (une arme sans état de charge entre au combat chargée — sinon tout
 * tireur perdrait son premier Round à recharger).
 */
function ouvrir() {
  useGame.setState({ party: scenario.makeParty() });
  useGame.getState().startScene(scenario.scene);
  useGame.getState().startCombat('enc-pistolets');
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  return b.combatants.find((c) => c.kind === 'hero')!;
}

describe('Scénario « Pistolets jumelés » — l’état de charge AUTHORÉ survit à l’entrée en combat', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ battle: null }); });

  it('les DEUX pistolets déclarés vides entrent VIDES (le geste de rechargement a un objet)', () => {
    const h = ouvrir();
    const pistolets = h.weapons.filter((w) => w.type === 'ranged' && (w.reload ?? 0) > 0);
    expect(pistolets.length, 'le set ne tient pas deux armes à Recharge').toBe(2);
    for (const p of pistolets) {
      expect(weaponLoaded(h, p), `« ${p.label} » (${p.uid}) est entré CHARGÉ malgré son \`loaded: false\` authoré`).toBe(false);
    }
    // … et c'est bien ce que le pool de capacités offre : la case de recharge est ALLUMÉE (à faire).
    expect(h.items?.filter((i) => i.uid.startsWith('pist-')).every((i) => i.loaded === false), 'la donnée authorée a été écrasée').toBe(true);
  });

  it('TÉMOIN — une arme qui ne DÉCLARE rien entre au combat CHARGÉE (le défaut tient)', () => {
    const party = scenario.makeParty();
    const h0 = party[0];
    // Même porteur, une arbalète de plus : aucun état de charge authoré sur elle.
    const arb = itemFromTrappingById('arbalete-lourde')!;
    arb.uid = 'arb-temoin';
    h0.items = [...(h0.items ?? []), arb];
    h0.loadouts = [{ id: 'lo-temoin', main: 'arb-temoin' }];
    h0.activeLoadoutId = 'lo-temoin';
    recomputeLoadout(h0);
    useGame.setState({ party });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('enc-pistolets');
    vi.clearAllTimers();
    const h = useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    const temoin = h.weapons.find((w) => w.uid === 'arb-temoin')!;
    expect(temoin, 'l’arbalète témoin n’est pas au set').toBeTruthy();
    expect(weaponLoaded(h, temoin), 'une arme sans état de charge déclaré devrait entrer chargée').toBe(true);
  });
});
