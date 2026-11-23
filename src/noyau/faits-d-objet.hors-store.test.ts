/**
 * LES FAITS D'OBJET (#4574 lot 3, PR 2b), par le chemin produit (banc du noyau) : la Déviation de l'automate porte
 * l'armure entamée avec sa Localisation (LDB 63 l.30) ; l'étape d'affichage du Piège-lame porte la lame brisée ou
 * lâchée (LDB 62 l.280) ; la Maladresse tirée prévoit ce que sa validation fait de l'arme (LDB 14 l.21-30).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { applyAttackResult, applyBladeTrap } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { cascadeDeTest } from './cascade.testkit';
import { pushDisplay } from './rollSeam';
import { emptyScene } from './monde/scene';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { jetsEnVue } from './jetsEnVue';
import { itemFromTrappingById, weaponFromItem, weaponIdentity } from '../engine/items';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import type { Combatant, Weapon } from '../engine/types';
import type { CascadeStep } from './pendings';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };
const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, label: id, kind, important: true, characteristics: { ...CHARS },
    wounds: blessuresDeBase(30), advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant);

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const etapes = (): CascadeStep[] => g().pendingCascade?.participants ?? [];
const gourdin: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
/** L'épée d'Ulrich, lame d'un catalogue, sans Atout Solide ni Incassable. */
const epee: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], uid: 'ep-ulrich', trappingId: 'epee', bladed: true };

describe('la Déviation de l’automate (LDB 63 l.30)', () => {
  it('sa révélation porte la Localisation, puis exactement l’armure entamée', () => {
    seedBattleRng(31);
    const e = mk('ennemi', 'e1', { weapons: [gourdin], pos: { x: 1, y: 0 } });
    const h = mk('heros', 'h1', { aiControlled: true, armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } });
    setBattle([e, h]);
    applyAttackResult(g, banc.setState, e, h, gourdin,
      { hit: true, attackerRoll: 44, netSL: 2, location: 'corps', critLocation: 'corps', damage: 5, woundsLost: 1, critical: true, advantageTo: null, defenderDefeated: false, log: 'double' });
    const revelation = etapes().find((s) => s.reveal?.kind === 'critique' && s.faits?.some((f) => f.genre === 'objet'));
    expect(revelation?.faits).toEqual([
      { genre: 'localisation', cible: 'h1', camp: 'groupe', valeur: 'corps' },
      { genre: 'objet', cible: 'h1', camp: 'groupe', objet: { armure: 'corps' }, valeur: -1, issue: 'usee' },
    ]);
  });
});

describe('le Piège-lame (LDB 62 l.280)', () => {
  /** Hilda pare et piège l'épée d'Ulrich : marge nette `marge`. Rend l'étape d'affichage de l'issue. */
  function pieger(marge: number): CascadeStep | undefined {
    seedBattleRng(7);
    const ulrich = mk('ennemi', 'ulrich', { weapons: [{ ...epee }], pos: { x: 1, y: 0 } });
    const hilda = mk('heros', 'hilda');
    setBattle([ulrich, hilda]);
    applyBladeTrap(g, banc.setState, hilda, { attackerId: 'ulrich', weaponUid: 'ep-ulrich', defSL: 0, attackerSL: 0 }, marge);
    return etapes().find((s) => s.kind === 'issueDuPiegeALame');
  }

  it('Succès Stupéfiant : la lame est brisée', () => {
    expect(pieger(6)?.faits).toEqual([{ genre: 'objet', cible: 'ulrich', camp: 'hostile', objet: { arme: 'epee' }, valeur: -1, issue: 'brisee' }]);
  });

  it('en deçà : la lame est lâchée', () => {
    expect(pieger(5)?.faits).toEqual([{ genre: 'objet', cible: 'ulrich', camp: 'hostile', objet: { arme: 'epee' }, valeur: 0, issue: 'lachee' }]);
  });
});

describe('la Maladresse tirée (LDB 14 l.21-30)', () => {
  /** Hilda a tiré `r` aux Oups ! avec `arme` : l'étape attend sa validation, une garde derrière elle. */
  function tirer(arme: Weapon, r: { roll: number; kind: 'weaponDamageActLast' | 'actionPenalty'; label: string }, over: Partial<Combatant> = {}): void {
    setBattle([mk('heros', 'hilda', { weapons: [arme], ...over })]);
    banc.setState({ pendingCascade: cascadeDeTest([{ id: 'cons-maladresse-hilda', kind: 'jetDeMaladresse', jet: 'maladresse', actorId: 'hilda', maladresse: { weapon: g().battle!.combatants[0].weapons[0], result: r } }], { title: '', purpose: 'combat' }) });
    pushDisplay(banc.setState, { id: 'garde', kind: 'issueDuPiegeALame', worldOwner: true, icon: 'melee/fuir', label: fixtureText('Garde') });
  }
  const prevus = () => jetsEnVue(g()).find((j) => j.flux === 'maladresse')?.lignes[0].consequences?.map(({ genre, valeur, detail }) => ({ genre, valeur, detail }));
  const armeDeHilda = () => g().battle!.combatants[0].weapons.find((w) => w.trappingId === 'gourdin');
  const ARME_ABIMEE = { roll: 25, kind: 'weaponDamageActLast', label: 'x' } as const;

  it('« arme abîmée » : la fenêtre prévoit l’usure de l’arme, que la validation applique', () => {
    tirer({ ...gourdin, trappingId: 'gourdin' }, ARME_ABIMEE);
    expect(prevus()).toEqual([{ genre: 'objet', valeur: -1, detail: { objet: { arme: 'gourdin' }, issue: 'usee' } }]);
    g().jetValider('maladresse');
    expect(armeDeHilda()?.damageTaken).toBe(1);
  });

  it('Bâclé (LDB 60 l.50) : la fenêtre prévoit l’arme brisée, puis son usure, que la validation applique', () => {
    tirer({ ...gourdin, trappingId: 'gourdin', qualities: [{ id: 'bacle' }] }, ARME_ABIMEE);
    expect(prevus()).toEqual([
      { genre: 'objet', valeur: -1, detail: { objet: { arme: 'gourdin' }, issue: 'brisee' } },
      { genre: 'objet', valeur: -1, detail: { objet: { arme: 'gourdin' }, issue: 'usee' } },
    ]);
    g().jetValider('maladresse');
    expect(armeDeHilda()).toBeUndefined();
  });

  it('Bâclé, objet source (LDB 60 l.50 ; LDB 62 l.135) : la casse brise l’objet, le Dégât d’arme l’use sans le briser une seconde fois', () => {
    const item = { ...itemFromTrappingById('arme-simple', idsDeTest)!, equipped: true };
    const arme = { ...weaponFromItem(item), qualities: [{ id: 'bacle' }] } as Weapon;
    tirer(arme, ARME_ABIMEE, { items: [item] });
    const objet = { arme: weaponIdentity(arme) };
    expect(prevus()).toEqual([
      { genre: 'objet', valeur: -1, detail: { objet, issue: 'brisee' } },
      { genre: 'objet', valeur: -1, detail: { objet, issue: 'usee' } },
    ]);
    g().jetValider('maladresse');
    expect(g().battle!.combatants[0].items!.find((i) => i.uid === item.uid)).toMatchObject({ destroyed: true, damageTaken: 1 });
  });

  it('Bâclé, arme de Trait (LDB 60 l.50) : la casse la lâche, le Dégât d’arme la laisse intacte', () => {
    const arme = { ...gourdin, uid: 'tr-arme', qualities: [{ id: 'bacle' }] } as Weapon;
    tirer(arme, ARME_ABIMEE, { traits: [{ id: 'arme', value: 4, uid: 'tr-arme' }] as Combatant['traits'] });
    expect(prevus()).toEqual([
      { genre: 'objet', valeur: -1, detail: { objet: { arme: 'tr-arme' }, issue: 'brisee' } },
      { genre: 'objet', valeur: 0, detail: { objet: { arme: 'tr-arme' }, issue: 'intacte' } },
    ]);
    g().jetValider('maladresse');
    expect(g().battle!.combatants[0].traits!.find((t) => t.uid === 'tr-arme')?.etatDArme).toEqual({ lachee: true });
  });

  it('Bâclé et Solide (LDB 60 l.30-32) : le dé de Sauvegarde reste à tirer, la fenêtre ne prévoit rien', () => {
    tirer({ ...gourdin, trappingId: 'gourdin', qualities: [{ id: 'bacle' }, { id: 'solide', value: 3 }] }, ARME_ABIMEE);
    expect(prevus()).toBeUndefined();
  });
});
