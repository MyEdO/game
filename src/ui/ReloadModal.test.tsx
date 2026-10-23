import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import type { PendingReload } from '../noyau/pendings';
import type { Combatant } from '../engine/types';
import { emptyArmour } from '../engine/items';
import { ReloadModalView } from './ReloadModal';

const noop = () => {};
// L'arme du loadout porte l'uid référencé par le Pending (résolu en NOM à l'affichage).
const pr = (o: Partial<PendingReload> & { weaponName?: string }): PendingReload => {
  const { weaponName: _wn, ...rest } = o;
  return {
    actorId: 'h1', actorName: 'Archère', weaponUid: 'w-arb', reload: 1, progressBefore: 0,
    skillValue: 45, difficulty: 'intermediaire', roll: null, target: 45, sl: 0, success: false, ...rest,
  };
};

// Acteur fictif portant l'arme de rechargement (uid → nom). Le nom d'affichage suit `weaponName` du test.
const actorWith = (weaponName: string, uid = 'w-arb'): Combatant =>
  ({
    id: 'h1', label: 'Archère', kind: 'hero', fortune: 0, items: [], armour: emptyArmour(0),
    weapons: [{ uid, label: weaponName, type: 'ranged', damage: { plusBF: false, flat: 0 }, qualities: [] }],
  } as unknown as Combatant);

/** La vue de `p`, que la coquille juge sur le Rechargement en attente (`fermeturesDuFlux`). */
function render(p: PendingReload & { _name?: string }, fortune = 1, weaponName = 'Arbalète') {
  useGame.setState({ pendingReload: p });
  try {
    return renderToStaticMarkup(
      <ReloadModalView pr={p} actor={actorWith(weaponName, p.weaponUid)} fortune={fortune} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
  } finally {
    useGame.setState({ pendingReload: null });
  }
}

describe('ReloadModalView — « si y’a un jet, y’a la modale »', () => {
  it('avant le jet : affiche l’arme, la cible et « Lancer » (pas « Appliquer »)', () => {
    const html = render(pr({ roll: null }));
    expect(html).toContain('Arbalète');
    expect(html).toContain('45'); // cible (Projectiles)
    expect(html).toContain('Lancer');
    expect(html).not.toContain('Appliquer');
  });

  it('après un jet réussi (DR ≥ Indice) : montre le DR, « rechargé ✓ » et « Appliquer »', () => {
    const html = render(pr({ roll: 22, target: 45, sl: 2, success: true }));
    expect(html).toContain('22'); // d100
    expect(html).toContain('DR');
    expect(html).toContain('rechargé');
    expect(html).toContain('Appliquer');
  });

  it('après un jet partiel (Recharge 2, DR 1) : montre la progression 1/2 DR', () => {
    const html = render(pr({ reload: 2, progressBefore: 0, roll: 40, target: 45, sl: 1, success: true }), 1, 'Arbalète lourde');
    expect(html).toContain('1/2 DR');
    expect(html).toContain('Arbalète lourde'); // uid → NOM (affichage)
  });

  it('progrès partiel cumulé (1 déjà + DR 0) reste 1/2 DR', () => {
    const html = render(pr({ reload: 2, progressBefore: 1, roll: 44, target: 45, sl: 0, success: true }));
    expect(html).toContain('1/2 DR');
  });
});
