import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { CYCLE_DE_CHARGE, loadRegister, weaponLoaded } from '../../engine/weaponLoad';
import { itemFromTrappingById, recomputeLoadout, loadWeapon, unloadWeapon, setAmmoChoice, setReloadProgress } from '../../engine/items';
import { finalizeBattle } from '../../state/combatFlow';
import type { Combatant, ItemInstance } from '../../engine/types';
import { scenario } from './44-pistolets-jumeles';

/**
 * L'entrée en combat ne fait que DÉFAUT (#1678 P4) : mesurée par le chemin réel (`startScene` +
 * `startCombat`), un état de charge DÉCLARÉ tient, un registre jamais commencé est chargé.
 */
function entrer(arranger?: (h: Combatant) => void): Combatant {
  const { party, scene } = scenario.construire();
  if (arranger) arranger(party[0]);
  useGame.setState({ party });
  useGame.getState().startScene(scene);
  useGame.getState().startCombat('enc-pistolets');
  vi.clearAllTimers();
  return useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
}

/** Tient l'objet `item` seul au set actif du porteur `h`. */
function tenirSeul(h: Combatant, item: ItemInstance): void {
  h.items = [...(h.items ?? []), item];
  h.loadouts = [{ id: 'lo-temoin', main: item.uid }];
  h.activeLoadoutId = 'lo-temoin';
  recomputeLoadout(h);
}

describe('Scénario « Pistolets jumelés » — l’état de charge déclaré survit à l’entrée en combat', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ battle: null }); });

  it('les DEUX pistolets authorés vides entrent VIDES', () => {
    const h = entrer();
    const pistolets = h.weapons.filter((w) => w.type === 'ranged' && (w.reload ?? 0) > 0);
    expect(pistolets.map((w) => w.uid).sort()).toEqual(['pist-droit', 'pist-gauche']);
    for (const p of pistolets) expect(weaponLoaded(h, p), `${p.uid} est entré chargé`).toBe(false);
  });

  it('une arme dont le cycle n’a jamais commencé entre CHARGÉE', () => {
    const arb = Object.assign(itemFromTrappingById('arbalete-lourde')!, { uid: 'arb-temoin' });
    expect(arb.loaded).toBeUndefined();
    const h = entrer((h0) => tenirSeul(h0, arb));
    const temoin = h.weapons.find((w) => w.uid === 'arb-temoin')!;
    expect(weaponLoaded(h, temoin)).toBe(true);
  });

  it('un Test étendu de rechargement en cours est CONSERVÉ', () => {
    const arq = Object.assign(itemFromTrappingById('arquebuse')!, { uid: 'arq-temoin', loaded: false, reloadProgress: 2 });
    const h = entrer((h0) => tenirSeul(h0, arq));
    const temoin = h.weapons.find((w) => w.uid === 'arq-temoin')!;
    expect(weaponLoaded(h, temoin)).toBe(false);
    expect(loadRegister(h, temoin).reloadProgress).toBe(2);
  });

  it('un cumul de rechargement authoré SANS `loaded` entre NON chargé, cumul conservé', () => {
    const arq = Object.assign(itemFromTrappingById('arquebuse')!, { uid: 'arq-cumul', reloadProgress: 2 });
    expect(arq).not.toHaveProperty('loaded');
    const h = entrer((h0) => tenirSeul(h0, arq));
    const temoin = h.weapons.find((w) => w.uid === 'arq-cumul')!;
    expect(weaponLoaded(h, temoin)).toBe(false);
    expect(loadRegister(h, temoin).reloadProgress).toBe(2);
  });

  it('le cycle de charge ne sort pas du combat : la rencontre suivante entre CHARGÉE, sur la munition choisie', () => {
    let h = entrer();
    let pist = h.weapons.find((w) => w.uid === 'pist-droit')!;
    setAmmoChoice(h, pist, 'mun-petites');
    loadWeapon(h, pist);
    unloadWeapon(h, pist);
    setReloadProgress(h, pist, 1);
    finalizeBattle(useGame.getState, useGame.setState);
    useGame.setState({ battle: null });

    const objet = useGame.getState().party[0].items!.find((i) => i.uid === 'pist-droit')!;
    for (const champ of Object.keys(CYCLE_DE_CHARGE)) expect(objet, champ).not.toHaveProperty(champ);
    expect(objet.ammoUid).toBe('mun-petites');

    useGame.getState().startCombat('enc-pistolets');
    vi.clearAllTimers();
    h = useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    pist = h.weapons.find((w) => w.uid === 'pist-droit')!;
    expect(weaponLoaded(h, pist)).toBe(true);
    expect(loadRegister(h, pist).loadedAmmoUid).toBe('mun-petites');
  });
});
