import { describe, it, expect } from 'vitest';
import { effetsDeLAppel, type Effet } from './effetsDeLAppel';
import type { ChargeDAttaque } from './bus';
import type { Evenement } from './partie';
import type { AttackResult } from '../engine/combat';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Weapon } from '../engine/types';
import type { Jeu } from './etat';

const arme = (w: Partial<Weapon>): Weapon => ({ label: 'arme', type: 'melee', damage: { flat: 0 }, qualities: [], ...w }) as Weapon;
const coup = (r: Partial<AttackResult>): AttackResult => ({ hit: true, critical: false, ...r }) as AttackResult;
const incantation = (r: Partial<MissileResult>): CastResult & Partial<MissileResult> => ({ cast: true, roll: 10, target: 50, sl: 4, isCritical: false, isFumble: false, log: '', ...r }) as CastResult & Partial<MissileResult>;
const emis = (payload: ChargeDAttaque): Evenement => ({ type: 'emis', evt: 'anim_attack', payload });
/** Un combat : `a` à 5 cases de `b` (10 m sur une scène de 2 m par case), `loin` à 500 cases, `hors` hors du plateau. */
const ETAT = { party: [], scene: { metresPerTile: 2 }, battle: { combatants: [{ id: 'a', pos: { x: 0, y: 0 } }, { id: 'b', pos: { x: 3, y: 4 } }, { id: 'loin', pos: { x: 300, y: 400 } }, { id: 'hors', pos: undefined }] } } as unknown as Jeu;
const unSeul = (e: Evenement): Effet => {
  const effets = effetsDeLAppel(ETAT, [e]);
  expect(effets).toHaveLength(1);
  return effets[0];
};

describe('effetsDeLAppel — le rendu de chaque coup, incantation et son de l’appel', () => {
  it('un canon : le rendu de son objet, pas de son Groupe de catalogue ; détonation, boulet, explosion', () => {
    const e = unSeul(emis({ kind: 'ranged', from: 'a', to: 'b', defense: 'none', result: coup({}), weapon: arme({ type: 'ranged', subType: 'armes-de-siege', weaponGroup: 'poudre-noire', trappingId: 'canon-petit' }) }));
    expect(e).toMatchObject({ quoi: 'coup', de: 'a', vers: 'b', issue: 'touche', depart: { visuel: 'eclair-de-bouche', son: { id: 'canon' } }, trajet: { projectile: 'boulet', dureeS: 10 / 90, hauteurM: expect.closeTo(0.4) }, arrivee: { visuel: 'explosion', son: { id: 'explosion' } } });
    expect(e.quoi === 'coup' && e.depart!.son!.fichiers.length).toBeGreaterThan(1);
  });

  it('un arc manqué : la flèche vole, le manque à l’arrivée', () => {
    expect(unSeul(emis({ kind: 'ranged', from: 'a', to: 'b', defense: 'esquive', result: coup({ hit: false }), weapon: arme({ type: 'ranged', subType: 'arc' }) }))).toMatchObject({ issue: 'manque', depart: { son: { id: 'arc' } }, trajet: { projectile: 'fleche' } });
  });

  it('une épée parée : la parade de l’arme qui pare, sans trajet ; un critique se dit', () => {
    const epee = arme({ subType: 'base' });
    expect(unSeul(emis({ kind: 'melee', from: 'a', to: 'b', defense: 'parade', result: coup({ hit: false }), weapon: epee, parryWeapon: epee }))).toMatchObject({ issue: 'pare', trajet: null, arrivee: { visuel: 'etincelles', son: { id: 'parade' } } });
    expect(unSeul(emis({ kind: 'melee', from: 'a', to: 'b', defense: 'none', result: coup({ critical: true }), weapon: epee }))).toMatchObject({ issue: 'critique', arrivee: { son: { id: 'tranche' } } });
  });

  it('une arme naturelle sans Groupe : le rendu de l’attaque naturelle', () => {
    expect(unSeul(emis({ kind: 'melee', from: 'a', to: 'b', defense: 'none', result: coup({}), weapon: arme({ natural: true }), creatureAttack: 'morsure' }))).toMatchObject({ issue: 'touche', couleur: '#b04030' });
  });

  it('un Projectile magique du Feu : le rendu du Domaine, teint à sa couleur', () => {
    expect(unSeul(emis({ kind: 'spell', projectile: true, from: 'a', to: 'b', defense: 'none', result: incantation({ hit: true }), spell: 'cauteriser' }))).toMatchObject({ quoi: 'coup', issue: 'touche', couleur: '#ff5a2a', arrivee: { visuel: 'gerbe-de-flammes', son: { id: 'sort-feu' } } });
  });

  it('un sort de soutien : une incantation, sans trajet ; une Prière a son rendu ; échouée, rien n’arrive', () => {
    expect(unSeul(emis({ kind: 'spell', projectile: false, from: 'a', to: 'a', defense: 'none', result: incantation({}), spell: 'benediction-de-bataille' }))).toMatchObject({ quoi: 'incantation', de: 'a', vers: 'a', reussie: true, depart: { visuel: 'canalisation' }, arrivee: { visuel: 'halo' } });
    expect(unSeul(emis({ kind: 'spell', projectile: false, from: 'a', to: 'b', defense: 'none', result: incantation({ cast: false }), spell: 'drain' }))).toMatchObject({ quoi: 'incantation', reussie: false, couleur: '#9b7bff', arrivee: null });
  });

  it('à bout portant, le vol garde sa durée la plus courte ; un combattant hors du plateau ne rend aucun coup', () => {
    const arc = arme({ type: 'ranged', subType: 'arc' });
    expect(unSeul(emis({ kind: 'ranged', from: 'a', to: 'a', defense: 'none', result: coup({}), weapon: arc }))).toMatchObject({ trajet: { dureeS: 0.08, hauteurM: 0 } });
    expect(unSeul(emis({ kind: 'ranged', from: 'a', to: 'loin', defense: 'none', result: coup({}), weapon: arc }))).toMatchObject({ trajet: { dureeS: 1000 / 45 } });
    expect(effetsDeLAppel(ETAT, [emis({ kind: 'ranged', from: 'a', to: 'hors', defense: 'none', result: coup({}), weapon: arc })])).toEqual([]);
  });

  it('un son de scène : le son du registre ; l’attaque spéciale d’une créature sur elle-même ne rend aucun coup', () => {
    expect(effetsDeLAppel(ETAT, [{ type: 'emis', evt: 'sfx', payload: { id: 'porte-ouvre' } }])).toEqual([{ quoi: 'son', son: { id: 'porte-ouvre', fichiers: expect.any(Array), volume: expect.any(Number) } }]);
    expect(effetsDeLAppel(ETAT, [emis({ kind: 'creature', from: 'a', to: 'a', defense: 'none', result: { hit: true }, creatureAttack: 'hurlement' })])).toEqual([]);
  });
});
