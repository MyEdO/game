/**
 * LA RÉACTION DE LA FENÊTRE DE DÉFENSE (#3059, J5) : chaque mode offert annonce la cible du jet que le flux jette une
 * fois ce mode réglé (`jetRegler('defense', 'reaction', m)`), Rapide (LDB 62 l.298-302) et substitution sociale
 * (LDB 09 l.207, l.287) compris. Après le dé, la fenêtre ne porte plus la réaction : la ligne est `defenderDetail`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { openAttackCascade } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { fenetreDeDefense } from './fenetreDeDefense';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import type { DefenseMode } from '../engine/combat';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 40 };
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, weapons: Weapon[], over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, ...over }) as unknown as Combatant);
const epee: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'ep', qualities: [] } as unknown as Weapon;
const rapiere: Weapon = { name: 'Rapière', label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'ra', qualities: [{ id: 'rapide' }] } as unknown as Weapon;

/** Fixture « la Rapière contre l'Intimidateur » : l'ennemi frappe d'une arme Rapide le héros qui pare à l'Épée, et
 *  l'ennemi a Peur du héros, qui possède Intimidation : la Parade, l'Esquive et la réaction sociale s'offrent. */
function ouvrirLaDefense(): void {
  seedBattleRng(7);
  const ennemi = mk('e', 'ennemi', { x: 1, y: 0 }, [rapiere], { psychState: [{ type: 'peur', sourceId: 'h', calmeDR: 0 }] } as Partial<Combatant>);
  const heros = mk('h', 'heros', { x: 0, y: 0 }, [epee], { skills: [{ id: 'intimidation', advances: 15, characteristic: 'force' }] } as Partial<Combatant>);
  const battle = {
    combatants: [ennemi, heros], order: [ennemi.id, heros.id], baseOrder: [ennemi.id, heros.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null, net: { ...initialNet(), mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
  openAttackCascade(g, banc.setState, { attackerId: ennemi.id, targetId: heros.id, location: null, result: null, weaponUid: 'ra' }, 'Attaque', 'action/attaquer');
  g().jetLancer('attaque');
  g().jetValider('attaque');
}

describe('fenêtre de Défense — la cible de chaque réaction est celle du jet', () => {
  it('Parade (Rapide), Esquive et réaction sociale : la cible annoncée = `defenderDetail.target` après le dé', () => {
    ouvrirLaDefense();
    const pd0 = g().pendingDefense;
    expect(pd0, 'chemin : la Défense du héros s’ouvre').toBeTruthy();
    const offertes = fenetreDeDefense(g())!.reaction!.options.map((o) => o.valeur);
    expect(offertes, 'fixture : les trois réactions s’offrent').toEqual(['parade', 'esquive', 'social']);
    for (const mode of offertes as DefenseMode[]) {
      banc.setState({ pendingDefense: pd0 });
      const annoncee = fenetreDeDefense(g())!.reaction!.options.find((o) => o.valeur === mode)!.cible;
      g().jetRegler('defense', 'reaction', mode);
      const vue = fenetreDeDefense(g())!;
      if (mode === 'parade') expect(vue.jet!.mods.map((m) => m.label), 'fixture : la Parade contre une arme Rapide porte son malus').toContain('Rapide');
      expect(vue.jet!.target, `${mode} : la ligne de la fenêtre et l’option disent la même cible`).toBe(annoncee);
      g().jetLancer('defense');
      expect(g().pendingDefense!.result!.defenderDetail!.target, `${mode} : la cible annoncée est celle jetée`).toBe(annoncee);
      expect(fenetreDeDefense(g())!.reaction, `${mode} : après le dé, la réaction ne se règle plus`).toBeNull();
      expect(fenetreDeDefense(g())!.jet, `${mode} : après le dé, la ligne est \`defenderDetail\``).toBeNull();
    }
  });
});
