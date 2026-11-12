/**
 * La réaction de Porte-Bouclier dans la fenêtre de Défense (`AA 13 l.84`, variante « Avantage de groupe ») : une fois
 * par Round, 2 Avantages, Dégâts ou poussée ; ses refus se lisent par `fenetreDeDefense(...).porteBouclier`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { openAttackCascade } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { fenetreDeDefense } from './fenetreDeDefense';
import { testScene } from '../scenes/test-fixture';
import { setRule } from '../engine/policy';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import { t } from '../i18n';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  setRule('combat-aa-avantage-groupe', true);
});
const g = () => banc.getState();

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 40 };
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, weapons: Weapon[], over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
    weapons, advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, ...over }) as unknown as Combatant);
const epee: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'ep', qualities: [] } as unknown as Weapon;
const bouclier: Weapon = { ...weaponFromItem(itemFromTrappingById('bouclier', idsDeTest)!), uid: 'sh', hand: 'secondaire' };

/** L'ennemi frappe le héros Porte-Bouclier qui pare au bouclier ; `avantage` dans la réserve des alliés, `projete`
 *  sur le héros (la même valeur hors de la fenêtre où une op a écrit la projection avant `reconcileAdvantageToPool`). */
function ouvrirLaDefense(avantage: number, dejaUtilise = false, projete = avantage): void {
  seedBattleRng(7);
  const ennemi = mk('e', 'ennemi', { x: 1, y: 0 }, [epee]);
  const heros = mk('h', 'heros', { x: 0, y: 0 }, [epee, bouclier], {
    talents: [{ talentId: 'porte-bouclier', times: 1 }], advantage: projete, usedShieldReactionRound: dejaUtilise,
  } as Partial<Combatant>);
  const battle = {
    combatants: [ennemi, heros], order: [ennemi.id, heros.id], baseOrder: [ennemi.id, heros.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    advantagePools: { allies: avantage, adversaires: 0 },
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null, net: { ...initialNet(), mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
  openAttackCascade(g, banc.setState, { attackerId: ennemi.id, targetId: heros.id, location: null, result: null, weaponUid: 'ep' }, 'Attaque', 'action/attaquer');
  g().jetLancer('attaque');
  g().jetValider('attaque');
  expect(g().pendingDefense, 'chemin : la Défense du héros s’ouvre').toBeTruthy();
  g().jetRegler('defense', 'reaction', 'parade');
  g().jetRegler('defense', 'armeDeParade', 'sh');
}

const refus = () => Object.fromEntries(fenetreDeDefense(g())!.porteBouclier!.options.map((o) => [String(o.valeur), o.refus]));

describe('fenêtre de Défense — Porte-Bouclier (AA 13 l.84)', () => {
  it('2 Avantages, bouclier en parade : Dégâts et poussée s’offrent avant le jet, au coût annoncé', () => {
    ouvrirLaDefense(2);
    const f = fenetreDeDefense(g())!;
    expect(f.porteBouclier, 'la parade au bouclier ouvre la réaction').not.toBeNull();
    expect(f.porteBouclier!.libelle).toBe(t('defense.porteBouclier', { cout: 2 }));
    expect(refus()).toEqual({ null: null, degats: null, repousser: null });
  });

  it('moins de 2 Avantages : la réaction se refuse, et dit le coût', () => {
    ouvrirLaDefense(1);
    expect(refus()).toMatchObject({ degats: t('defense.refus.avantages', { cout: 2, nom: 'h', avantage: 1 }), repousser: t('defense.refus.avantages', { cout: 2, nom: 'h', avantage: 1 }) });
  });

  it('la réserve du camp fait foi (AA 11 l.30), pas la projection du héros : celle que dépense la réaction', () => {
    ouvrirLaDefense(2, false, 0);
    expect(refus()).toEqual({ null: null, degats: null, repousser: null });
    ouvrirLaDefense(1, false, 3);
    expect(refus().repousser).toBe(t('defense.refus.avantages', { cout: 2, nom: 'h', avantage: 1 }));
  });

  it('une fois par Round : déjà jouée ce Round, elle se refuse', () => {
    ouvrirLaDefense(2, true);
    expect(refus()).toMatchObject({ degats: t('defense.refus.bouclierUtilise'), repousser: t('defense.refus.bouclierUtilise') });
  });

  it('après le jet : la poussée ne se règle plus, les Dégâts exigent une Défense gagnée', () => {
    ouvrirLaDefense(2);
    g().jetLancer('defense');
    g().jetImposerLeResultat('defense', 99);
    const r = refus();
    expect(r.repousser).toBe(t('defense.refus.jetLance'));
    expect(r.degats).toBe(t('defense.refus.degatsSansDefenseGagnee'));
    expect(r.null).toBe(t('defense.refus.jetLance'));
  });
});
