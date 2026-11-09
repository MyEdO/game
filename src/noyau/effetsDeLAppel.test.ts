import { describe, it, expect } from 'vitest';
import { effetsDeLAppel, zonesQuiDurent, SONS_DE_LA_PARTIE, TEINTE_DU_CRITIQUE, TEINTE_DU_FLOTTANT, type Effet } from './effetsDeLAppel';
import { findDomainById, findSpellById } from '../data';
import { sonDEffet } from '../data/sons/registre';
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
    expect(effetsDeLAppel(ETAT, [{ type: 'emis', evt: 'sfx', payload: { id: 'porte-ouvre' } }])).toEqual([{ quoi: 'son', son: { id: 'porte-ouvre', fichiers: expect.any(Array), volume: expect.any(Number) }, fois: 1, ecartS: 0 }]);
    expect(effetsDeLAppel(ETAT, [emis({ kind: 'creature', from: 'a', to: 'a', defense: 'none', result: { hit: true }, creatureAttack: 'hurlement' })])).toEqual([]);
  });

  it('les flottants d’un coup à son arrivée : ses Blessures, critiques à leur teinte, encaissé, hors de combat ; paré ou esquivé, raté', () => {
    const epee = arme({ subType: 'base' });
    const flottants = (defense: 'parade' | 'none', r: Partial<AttackResult>) => {
      const e = unSeul(emis({ kind: 'melee', from: 'a', to: 'b', defense, result: coup(r), weapon: epee }));
      return e.quoi === 'coup' ? e.flottants.map((f) => [f.genre, f.texte, f.couleur]) : [];
    };
    expect(flottants('none', { woundsLost: 4 })).toEqual([['damage', '-4', TEINTE_DU_FLOTTANT.damage]]);
    expect(flottants('none', { woundsLost: 4, critical: true, defenderDefeated: true })).toEqual([['damage', '-4', TEINTE_DU_CRITIQUE], ['death', '✦ hors de combat', TEINTE_DU_FLOTTANT.death]]);
    expect(flottants('none', { woundsLost: 0 })).toEqual([['soak', 'Encaissé', TEINTE_DU_FLOTTANT.soak]]);
    expect(flottants('parade', { hit: false })).toEqual([['defend', 'Paré / Esquivé', TEINTE_DU_FLOTTANT.defend]]);
    expect(flottants('none', { hit: false })).toEqual([['miss', 'Raté', TEINTE_DU_FLOTTANT.miss]]);
  });

  it('une incantation ratée le dit sur sa cible ; un Projectile magique dit ses Blessures', () => {
    expect(unSeul(emis({ kind: 'spell', projectile: false, from: 'a', to: 'b', defense: 'none', result: incantation({ cast: false }), spell: 'drain' }))).toMatchObject({ flottants: [{ genre: 'miss', texte: 'Incantation ratée' }] });
    expect(unSeul(emis({ kind: 'spell', projectile: false, from: 'a', to: 'a', defense: 'none', result: incantation({}), spell: 'benediction-de-bataille' }))).toMatchObject({ flottants: [] });
    expect(unSeul(emis({ kind: 'spell', projectile: true, from: 'a', to: 'b', defense: 'none', result: incantation({ hit: true, woundsLost: 6 }), spell: 'cauteriser' }))).toMatchObject({ flottants: [{ genre: 'damage', texte: '-6' }] });
  });

  it('un flottant du bus au-dessus de son combattant ou de sa case', () => {
    expect(unSeul({ type: 'emis', evt: 'anim_float', payload: { to: 'b', text: '+2', kind: 'heal' } })).toEqual({ quoi: 'flottant', sur: 'b', case: null, flottant: { genre: 'heal', texte: '+2', couleur: TEINTE_DU_FLOTTANT.heal, critique: false } });
    expect(unSeul({ type: 'emis', evt: 'anim_float', payload: { pos: { x: 2, y: 3 }, text: '⤬ dévie', kind: 'miss' } })).toMatchObject({ sur: null, case: { x: 2, y: 3 } });
  });

  it('les pas d’un déplacement, un par deux cases, quatre au plus ; le heurt d’un pas refusé, le gong de la victoire, les dés', () => {
    const pas = (n: number) => unSeul({ type: 'emis', evt: 'anim_move', payload: { id: 'a', path: Array.from({ length: n }, (_, x) => ({ x, y: 0 })) } });
    expect(pas(1)).toMatchObject({ quoi: 'son', son: { id: SONS_DE_LA_PARTIE.pas }, fois: 1, ecartS: 0.22 });
    expect(pas(6)).toMatchObject({ fois: 3 });
    expect(pas(20)).toMatchObject({ fois: 4 });
    expect(unSeul({ type: 'emis', evt: 'move_blocked', payload: {} })).toMatchObject({ son: { id: SONS_DE_LA_PARTIE.heurt }, fois: 1 });
    expect(unSeul({ type: 'emis', evt: 'battle_over', payload: { victory: true } })).toMatchObject({ son: { id: SONS_DE_LA_PARTIE.victoire } });
    expect(effetsDeLAppel(ETAT, [{ type: 'emis', evt: 'battle_over', payload: { victory: false } }])).toEqual([]);
    expect(unSeul({ type: 'emis', evt: 'dice_roll', payload: undefined })).toMatchObject({ son: { id: SONS_DE_LA_PARTIE.des } });
  });

  it('un État gagné flotte sur son porteur, à son nom', () => {
    expect(unSeul({ type: 'etatGagne', porteur: 'b', etat: 'en-flammes' })).toEqual({ quoi: 'flottant', sur: 'b', case: null, flottant: { genre: 'condition', texte: 'En flammes', couleur: TEINTE_DU_FLOTTANT.condition, critique: false } });
  });

  it('les zones qui durent : celle d’un sort au rendu de son Domaine, une fumée au sien, une zone sans rendu cachée', () => {
    const cases = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
    const sort = findSpellById('mur-de-feu')!;
    const [feu, fumee, seconde] = zonesQuiDurent([
      { label: 'Mur', tiles: cases, rounds: 3, source: { kind: 'spell', id: sort.id } },
      { label: 'Fumée', tiles: cases, rounds: 2, blocksLoS: true, rendu: { id: 'souffle-de-fumee' } },
      { label: 'Piège', tiles: cases, rounds: 1, permanent: true, perRound: [] },
      { label: 'Fumée', tiles: cases, rounds: 2, rendu: { id: 'souffle-de-fumee' } },
    ]);
    expect(feu).toMatchObject({ cases, centre: { x: 2, y: 1 }, couleur: findDomainById(sort.domainId!.id)!.couleur, visuel: 'nappe-de-flammes', boucle: { id: 'crepitement' } });
    expect(fumee).toMatchObject({ visuel: 'nuage', boucle: null });
    expect(seconde.cle, 'deux zones au même rendu et au même centre gardent chacune sa clé').not.toBe(fumee.cle);
    expect(zonesQuiDurent([{ label: 'Piège', tiles: cases, rounds: 1 }])).toEqual([]);
  });

  it('chaque son de la partie est au registre', () => {
    for (const id of Object.values(SONS_DE_LA_PARTIE)) expect(sonDEffet(id), id).not.toBeNull();
  });
});
