/**
 * GARDE DE CLASSE (#2097, B4) : aucune surface de TRACÉ ne retient une référence de l'état vivant du
 * combat. Un combat joué au store (tir qui décharge une arme à Recharge, rechargement, armure abîmée)
 * trace ENTRE CHAQUE ACTION tout ce que dessine un combattant : ses sujets de billboard dans toutes les
 * vues × sens (repos et frame de geste), ses clés, et son portrait (`tokenBodyKind`, vue du dessus).
 * Le combat mute ses armes et son armure EN PLACE (`unloadWeapon`, `setReloadProgress`,
 * `damageArmour`) : un tracé qui aurait gelé l'une de ces références ferait lever l'action suivante.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { actorBillboards, actorIdentityKey, actorPoseKey, type ActorPose } from './sceneMeshes';
import { tokenBodyKind } from '../../tokenBodyKind';
import { useGame, type BattleState } from '../../../state/store';
import { emptyScene, sceneMetresPerTile } from '../../../state/scene';
import { createHero } from '../../../engine/character';
import { damageArmour } from '../../../engine/items';
import { loadRegister } from '../../../engine/weaponLoad';
import { rigIdleDef } from '../../rig/anim/actorAnimSelect';
import { VIEWS } from '../../rig/facing';
import type { Combatant, Weapon } from '../../../engine/types';
import { objetDeTest } from '../../../engine/objetDeTest.testkit';

const scene = emptyScene(8, 8);
const mpt = sceneMetresPerTile(scene);

function combat(): { H: Combatant; E: Combatant } {
  const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
  H.weapons = [{ uid: 'w-arb', label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], subType: 'Arbalète', reload: 1, shape: 'arbalete' } as unknown as Weapon];
  H.items = [...(H.items ?? []), objetDeTest({ uid: 'am1', trappingId: 'carreau', kind: 'ammo', qualities: [], enc: 0, equipped: false, subType: 'Arbalète', qty: 3 })];
  loadRegister(H, H.weapons[0]).loaded = true;
  H.pos = { x: 0, y: 0 };
  const E: Combatant = JSON.parse(JSON.stringify(H));
  E.id = 'enemy-0';
  E.label = 'Cible';
  E.kind = 'enemy';
  E.pos = { x: 4, y: 0 };
  const battle = {
    combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 99, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ party: [H], mode: 'battle', battle, scene, pendingReload: null, pendingAttack: null });
  return { H, E };
}

const vivants = (): Combatant[] => useGame.getState().battle!.combatants;

/** TOUT ce que dessine chaque combattant vivant, dans toutes les vues × sens. */
function tracerTout(): void {
  for (const c of vivants()) {
    const p: ActorPose = { c, x: c.pos!.x, y: c.pos!.y, z: 0, facing: 'S' };
    actorPoseKey(p);
    actorIdentityKey(p);
    for (const s of actorBillboards([p], scene, mpt))
      for (const view of VIEWS)
        for (const mirror of [false, true]) {
          s.svg(view, mirror, 0);
          s.frameSvg?.(view, mirror, rigIdleDef(), 2, 8);
        }
    renderToStaticMarkup(<svg>{tokenBodyKind({ kind: 'combatant', combatant: c }, 'top').body}</svg>);
  }
}

describe('combat au store : tracer entre chaque action ne gèle rien de l’état vivant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('tir (décharge à Recharge), rechargement, armure abîmée — aucune action ne lève', () => {
    const { H, E } = combat();
    const g = useGame.getState;
    g().seedRng(2);
    const tireur = () => vivants().find((c) => c.id === H.id)!;
    let déchargée = false;
    const abîmées: boolean[] = [];
    const actions: [string, () => void][] = [
      ['viser', () => g().battleClickEntity(E.id, { confirm: true })],
      ['jet d’attaque', () => g().attackRoll()],
      ['tir appliqué (décharge)', () => { g().attackConfirm(); déchargée = !loadRegister(tireur(), tireur().weapons[0]).loaded; }],
      ['nouveau tour du tireur', () => useGame.setState((s) => ({ battle: { ...s.battle!, acted: false } }))],
      ['ouvrir le rechargement', () => g().battleReload()],
      ['jet de rechargement', () => g().reloadRoll()],
      ['rechargement appliqué', () => g().reloadConfirm()],
      ['armure abîmée', () => { for (const c of vivants()) abîmées.push(damageArmour(c, 'corps')); }],
    ];
    tracerTout();
    for (const [nom, action] of actions) {
      expect(action, nom).not.toThrow();
      expect(tracerTout, `tracé après « ${nom} »`).not.toThrow();
    }
    expect(déchargée, 'le tir a bien déchargé l’arme à Recharge').toBe(true);
    expect(g().battle!.log.some((e) => e.kind === 'reload'), 'le rechargement a bien été appliqué').toBe(true);
    expect(abîmées, 'une armure a bien été abîmée').toContain(true);
  });
});
