/**
 * Le jezaïl à malepierre tiré sans partenaire perd Pointue et Précise : l'arme effective de `firedWeapon`, la même
 * pour un PNJ et un héros, et la fenêtre d'attaque qui dit la perte. ZI 13 l.193 ; #4202
 */
import { describe, it, expect } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { addCondition, COND } from '../engine/conditions';
import { resolveQualities } from '../engine/qualities/dispatch';
import type { Combatant, Weapon } from '../engine/types';
import { findTrappingById, findCreatureById } from '../data';
import { firedWeapon } from './combatFlow';
import { spawnEnemy } from './monde/spawn';
import { creerPartie, etatInitialDuJeu, fenetreDAttaque, type EntreesDeLaPartie } from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';

const JEZAIL = 'jezail-a-malepierre';

/** Le Technomage du bestiaire, armé de son jezaïl, en (5,5). */
function technomage(): { tireur: Combatant; arme: Weapon } {
  const tireur = spawnEnemy({ presetCreature: findCreatureById('technomage')!, presetId: 'technomage' }, 'technomage-1', { x: 5, y: 5 });
  const arme = tireur.weapons.find((w) => w.trappingId === JEZAIL);
  expect(arme, 'le Technomage porte son jezaïl').toBeDefined();
  return { tireur, arme: arme! };
}

/** Un héros de test qui tient le jezaïl du catalogue (chargé, avec sa balle), en (5,5). */
function heros(): { tireur: Combatant; arme: Weapon } {
  const jezail = { ...itemFromTrappingById(JEZAIL, idsDeTest)!, loaded: true };
  const balle = itemFromTrappingById('balle-et-poudre', idsDeTest)!;
  const tireur = combattantDeTest({ id: 'heros-1', label: 'Tireur', kind: 'heros', pos: { x: 5, y: 5 }, items: [jezail, balle], loadouts: [{ id: 'j', main: jezail.uid }] as never, activeLoadoutId: 'j' });
  recomputeLoadout(tireur);
  const arme = tireur.weapons.find((w) => w.uid === jezail.uid);
  expect(arme, 'le héros tient le jezaïl').toBeDefined();
  return { tireur, arme: arme! };
}

const voisin = (id: string, kind: Combatant['kind'], x: number, y: number): Combatant => combattantDeTest({ id, label: id, kind, pos: { x, y } });

/** Les qualités résolues de l'arme que `tireur` tire sur une cible à 6 cases, parmi `tireur`, la cible et `autres`. */
function qualitesTirees(t: { tireur: Combatant; arme: Weapon }, autres: Combatant[]): string[] {
  const cible = voisin('cible', t.tireur.kind === 'heros' ? 'ennemi' : 'heros', 11, 5);
  return resolveQualities(firedWeapon(findTrappingById, null, t.tireur, cible, t.arme.uid, [t.tireur, cible, ...autres])).map((r) => r.id);
}

const PERDUES = ['pointue', 'precise'];
const GARDEES = ['devastatrice', 'recharge', 'dangereuse'];

describe.each([
  { porteur: 'Technomage (PNJ)', tireur: technomage },
  { porteur: 'héros', tireur: heros },
])('jezaïl à malepierre du $porteur — ZI 13 l.193', ({ tireur }) => {
  const camp = () => tireur().tireur.kind;

  it('seul : Pointue et Précise perdues, les autres qualités intactes', () => {
    const q = qualitesTirees(tireur(), []);
    expect(q.filter((id) => PERDUES.includes(id))).toEqual([]);
    expect(q).toEqual(expect.arrayContaining(GARDEES));
  });

  it('un allié adjacent conscient : Pointue et Précise gardées', () => {
    expect(qualitesTirees(tireur(), [voisin('allie', camp(), 6, 5)])).toEqual(expect.arrayContaining([...PERDUES, ...GARDEES]));
  });

  it('un allié adjacent À Terre mais conscient : gardées', () => {
    const allie = voisin('allie', camp(), 6, 5);
    addCondition(allie, COND.aTerre);
    expect(qualitesTirees(tireur(), [allie])).toEqual(expect.arrayContaining(PERDUES));
  });

  it('un allié adjacent Inconscient, ou mort : perdues', () => {
    const inconscient = voisin('inconscient', camp(), 6, 5);
    addCondition(inconscient, COND.inconscient);
    const mort = { ...voisin('mort', camp(), 4, 5), dead: true };
    const q = qualitesTirees(tireur(), [inconscient, mort]);
    expect(q.filter((id) => PERDUES.includes(id))).toEqual([]);
  });

  it('un allié à 2 cases : perdues', () => {
    expect(qualitesTirees(tireur(), [voisin('allie', camp(), 7, 5)]).filter((id) => PERDUES.includes(id))).toEqual([]);
  });

  it('un ennemi adjacent : perdues', () => {
    const adverse = camp() === 'heros' ? 'ennemi' : 'heros';
    expect(qualitesTirees(tireur(), [voisin('adverse', adverse, 6, 5)]).filter((id) => PERDUES.includes(id))).toEqual([]);
  });
});

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

describe('la fenêtre d’attaque dit la perte du jezaïl tiré seul — ZI 13 l.193', () => {
  it('le héros seul vise au jezaïl : la note nomme Pointue et Précise', () => {
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
    ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { H, E, patch } = auContact(garde);
    const jezail = { ...itemFromTrappingById(JEZAIL, idsDeTest)!, loaded: true };
    H.items = [...(H.items ?? []), jezail, itemFromTrappingById('balle-et-poudre', idsDeTest)!];
    H.loadouts = [{ id: 'j', main: jezail.uid }] as never;
    H.activeLoadoutId = 'j';
    recomputeLoadout(H);
    E.pos = { x: 16, y: 10 };
    const partie = creerPartie({ ...garde, ...patch }, ENTREES);
    try {
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos }, E.id, { confirm: true }] });
      const f = fenetreDAttaque(partie.etat());
      expect(f, 'aucune fenêtre d’attaque lue').not.toBeNull();
      expect(f!.arme).toBe('Jezaïl à malepierre');
      expect(f!.sansEquipe).toBe('Sans servant ni allié adjacent : −Pointue, −Précise.');
    } finally {
      partie.fermer();
    }
  });
});
