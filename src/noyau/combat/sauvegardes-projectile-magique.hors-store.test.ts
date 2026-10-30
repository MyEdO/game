/**
 * SAUVEGARDES DE TOUCHE au chemin du PROJECTILE MAGIQUE (`applyCast` → `appliquerTouchePourCible`).
 *
 * Le trait Démoniaque (`LDB 85 l.98`) sauve après chaque coup reçu : un Projectile magique en est un.
 * Le chemin du Projectile ré-implémentait le Dôme et le Martyr et n'appelait JAMAIS le collecteur de
 * sauvegardes — un démon touché par un Dard ne sauvait rien. Ces contrats mordent DEPUIS LE GESTE
 * (le vrai `applyCast`), et l'Indice y est toujours celui de la DONNÉE, jamais un nombre du code :
 * un Indice de 1 sauve TOUJOURS (1d10 ≥ 1), un Indice de 11 ne sauve JAMAIS.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import type { BattleState } from '../etat';
import { applyCast } from '../combatFlow';
import { evaluateMissile, type CastResult } from '../../engine/magic';
import { seedBattleRng, battleRng } from '../battleRng';
import { draineEtLit } from '../cascade.testkit';
import { emptyScene } from '../monde/scene';
import type { Combatant } from '../../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

/** Projectile arcane MINIMAL (non curé → aucun Flow) : Dégâts 8 + DR + BFM. */
const missileSpell = (): never =>
  ({ id: 'dard-test', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8 }) as never;

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const cr = (sl: number): CastResult =>
  ({ cast: true, roll: 44, target: 60, sl, isCritical: false, isFumble: false, log: '' });

/** Lance le Projectile par le VRAI chemin (`applyCast`) PUIS JOUE LA PORTE : depuis #1508 la sauvegarde
 *  naît en ÉTAPE de dé NON RÉSOLUE (une par cible, poussée avant toute mutation) et c'est la fenêtre qui
 *  la jette — le drainage tient ici le rôle du joueur. Rend ce que celui-ci a LU. */
function castMissile(caster: Combatant, target: Combatant): string[] {
  const spell = missileSpell();
  const mres = evaluateMissile(caster, target, spell, cr(4));
  applyCast(banc.getState, banc.setState, caster, target, spell, mres, true, false, undefined, undefined);
  return draineEtLit(banc.getState);
}

/** Aura de Dôme portée par `warden`, d'Indice `indice` (la DONNÉE du sort, op `domeWard`). */
const dome = (indice: number): Combatant['activeEffects'] =>
  ([{ label: 'Dôme', bonus: 0, domeWard: { radiusMeters: 4, ward: { id: 'protection', value: indice } } }] as unknown as Combatant['activeEffects']);

describe('LDB 85 l.98 — « après chaque coup reçu » : le Projectile magique EST un coup reçu', () => {
  it('Démoniaque d’Indice 1 : la sauvegarde tombe toujours, le Dard ne retire AUCUNE Blessure', () => {
    const mage = mk('hero', 'mage');
    const demon = mk('enemy', 'demon', { traits: [{ id: 'demoniaque', value: 1 }] as never });
    setBattle([mage, demon]);
    castMissile(mage, demon);
    expect(demon.wounds.current, 'le coup est ignoré (1d10 ≥ 1)').toBe(30);
  });

  it('Démoniaque d’Indice 11 : aucune sauvegarde ne tombe, le Dard blesse normalement', () => {
    const mage = mk('hero', 'mage');
    const demon = mk('enemy', 'demon', { traits: [{ id: 'demoniaque', value: 11 }] as never });
    setBattle([mage, demon]);
    castMissile(mage, demon);
    expect(demon.wounds.current, 'aucun 1d10 n’atteint 11').toBeLessThan(30);
  });
});

describe('LDB 47 l.410 — le Dôme couvre contre les attaques MAGIQUES, et son Indice vient de la DONNÉE', () => {
  it('Dôme d’Indice 1, lanceur DEHORS : le Projectile est dévié', () => {
    const warden = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(1) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 } });
    const mage = mk('enemy', 'mage', { pos: { x: 20, y: 5 } });
    setBattle([warden, cible, mage]);
    castMissile(mage, cible);
    expect(cible.wounds.current, 'le dôme sauve (1d10 ≥ 1)').toBe(30);
  });

  it('Dôme d’Indice 11 : aucun dé ne l’atteint — le Projectile passe (l’Indice n’est PAS un nombre du code)', () => {
    const warden = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(11) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 } });
    const mage = mk('enemy', 'mage', { pos: { x: 20, y: 5 } });
    setBattle([warden, cible, mage]);
    castMissile(mage, cible);
    expect(cible.wounds.current, 'un seuil de 11 ne sauve jamais').toBeLessThan(30);
  });

  it('DEUX dômes couvrants : « gagne le Trait » — un seul dé, pas deux (le RNG le prouve)', () => {
    // Le Trait ne se possède qu'UNE fois : les deux dômes d'Indice 11 ne peuvent pas sauver, et le
    // nombre de dés jetés se LIT sur l'avance du RNG (une sonde après coup, même graine).
    const avecNDomes = (n: number): number => {
      seedBattleRng(7);
      const gardiens = Array.from({ length: n }, (_, i) => mk('hero', `gardien${i}`, { pos: { x: 5, y: 5 }, activeEffects: dome(11) }));
      const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 } });
      const mage = mk('enemy', 'mage', { pos: { x: 20, y: 5 } });
      setBattle([...gardiens, cible, mage]);
      castMissile(mage, cible);
      return battleRng().int(1, 1_000_000);
    };
    expect(avecNDomes(2), 'deux dômes ne jettent pas un dé de plus qu’un seul').toBe(avecNDomes(1));
  });

  it('la cible porte DÉJÀ le Trait que le dôme octroie : un seul dé, pas deux', () => {
    const avecDome = (sousDome: boolean): number => {
      seedBattleRng(7);
      const gardien = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, ...(sousDome ? { activeEffects: dome(11) } : {}) });
      const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 }, traits: [{ id: 'protection', value: 11 }] as never });
      const mage = mk('enemy', 'mage', { pos: { x: 20, y: 5 } });
      setBattle([gardien, cible, mage]);
      castMissile(mage, cible);
      return battleRng().int(1, 1_000_000);
    };
    expect(avecDome(true), 'le dôme n’ajoute pas un second dé au porteur du même Trait').toBe(avecDome(false));
  });

  it('DEUX Traits (le sien + celui du Dôme) : le dé RATÉ s’écrit AUSSI quand le suivant sauve', () => {
    // Le Trait propre est jeté d'abord (Indice 11 : il ne peut PAS sauver), le Trait octroyé ensuite
    // (Indice 1 : il sauve toujours). Les DEUX dés sont jetés, les DEUX s'écrivent, dans cet ordre —
    // une réussite n'efface pas le dé qui l'a précédée.
    const warden = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(1) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 }, traits: [{ id: 'demoniaque', value: 11 }] as never });
    const mage = mk('enemy', 'mage', { pos: { x: 20, y: 5 } });
    setBattle([warden, cible, mage]);
    const lignes = castMissile(mage, cible);
    const rate = lignes.findIndex((x) => /n’ignore pas le coup — sauvegarde 1d10 : \d+ < Démoniaque \(11\+\)\./.test(x));
    const sauve = lignes.findIndex((x) => /ignore le coup — sauvegarde 1d10 : \d+ ≥ Protection \(1\+\) du Dôme\./.test(x));
    expect(rate, `la RATÉE du Trait propre manque : ${lignes.join(' | ')}`).toBeGreaterThanOrEqual(0);
    expect(sauve, `la RÉUSSIE du Dôme manque : ${lignes.join(' | ')}`).toBeGreaterThanOrEqual(0);
    expect(rate, 'les deux dés se lisent dans l’ordre où ils sont tombés').toBeLessThanOrEqual(sauve);
    expect(cible.wounds.current, 'le Dôme a sauvé : aucune Blessure').toBe(30);
  });

  /**
   * F2 — la REPRISE d'une sauvegarde RATÉE (`reprendreApresSauvegarde` → `appliquerToucheDeProjectile`)
   * rend ses lignes en `string[]` : jouées EN COMBAT, elles doivent atterrir dans le journal de COMBAT,
   * la seule surface que le joueur regarde alors (`combatLog.journaliser`). Sinon le dénouement de la
   * touche « finit en rien » — le journal d'exploration n'est pas ouvrable pendant un combat.
   */
  it('F2 — sauvegarde RATÉE : le journal de la touche (Blessures) est dans `battle.log`, pas dans `journal`', () => {
    const mage = mk('hero', 'mage');
    const demon = mk('enemy', 'demon', { traits: [{ id: 'demoniaque', value: 11 }] as never });
    setBattle([mage, demon]);
    castMissile(mage, demon);
    const lu = banc.getState().battle!.log.map((e) => e.text).join(' | ');
    expect(demon.wounds.current, 'aucun 1d10 n’atteint 11 : le coup porte').toBeLessThan(30);
    expect(lu, 'le dé raté se lit').toContain('n’ignore pas le coup');
    expect(lu, 'et le dénouement de la touche AUSSI — la reprise ne le perd pas').toMatch(/Blessure/);
    expect(banc.getState().journal, 'rien ne part au journal d’exploration pendant un combat').toEqual([]);
  });

  it('Dôme d’Indice 1, lanceur DEDANS : « provenant de l’extérieur » — rien n’est dévié', () => {
    const warden = mk('hero', 'gardien', { pos: { x: 5, y: 5 }, activeEffects: dome(1) });
    const cible = mk('hero', 'couvert', { pos: { x: 6, y: 5 } });
    const mage = mk('enemy', 'mage', { pos: { x: 5, y: 6 } });
    setBattle([warden, cible, mage]);
    castMissile(mage, cible);
    expect(cible.wounds.current, 'le lanceur est sous le dôme').toBeLessThan(30);
  });
});
