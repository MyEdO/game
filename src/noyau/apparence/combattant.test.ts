/**
 * #3253 — ce que porte un combattant (`porteeDuCombattant`) : sa race de rendu, sa tête, ses armes tenues puis rangées,
 * les objets équipés qu'un ensemble habille et son emblème, par le même assembleur d'objet qu'une composition. Les
 * attendus se lisent au catalogue, jamais recopiés.
 */
import { describe, expect, it } from 'vitest';
import { porteeDuCombattant } from './combattant';
import { facteursDeComposition } from './composition';
import { piecesDEnsemble } from './gardeRobe';
import { createHero } from '../../engine/character';
import { itemFromGive, loadoutCreate, loadoutSetActive, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import { findCreatureById, findSpeciesById, findTrappingById, raceAppearance } from '../../data';
import { spawnEnemy } from '../monde/spawn';
import { ficheDEntite } from '../monde/sceneNpc';
import type { Combatant, ItemInstance } from '../../engine/types';

const REIKLANDER = 'humains-reiklander';

const heros = (opts: Partial<Parameters<typeof createHero>[0]> = {}): Combatant =>
  createHero({ speciesId: REIKLANDER, careerId: 'soldat', label: 'Porteur', seed: 3, ...opts });

const objet = (trappingId: string): ItemInstance => ({ ...itemFromGive({ trappingId }), uid: trappingId });

/** Un héros qui tient `tenue` en main directrice, et range `rangee` dans un second set. */
function herosArme(tenue: string, rangee: string): Combatant {
  const c = heros();
  c.items = [objet(tenue), objet(rangee)];
  c.loadouts = [];
  const second = loadoutCreate(c);
  loadoutSetSlot(c, second, 'main', rangee);
  const premier = loadoutCreate(c);
  loadoutSetSlot(c, premier, 'main', tenue);
  loadoutSetActive(c, premier);
  recomputeLoadout(c);
  return c;
}

const creature = (id: string): Combatant => spawnEnemy({ presetCreature: findCreatureById(id)!, presetId: id }, `${id}-1`, { x: 0, y: 0 });

describe('porteeDuCombattant', () => {
  it('un héros d’espèce jouable : la race de rendu de son espèce (`refChar`), la tête de cette race et ses facteurs', () => {
    const race = raceAppearance.find((r) => r.id === findSpeciesById(REIKLANDER)!.refChar)!;
    const portee = porteeDuCombattant(heros())!;
    expect(portee.portees[0].cle).toEqual({ champ: 'tete', id: race.id });
    expect(portee.facteurs).toEqual(facteursDeComposition(undefined, race));
  });

  it('une créature de race porte la tête de sa race', () => {
    expect(porteeDuCombattant(creature('squelette'))!.portees[0].cle).toEqual({ champ: 'tete', id: 'squelette' });
  });

  it('une créature sans base humanoïde ne porte rien', () => {
    expect(porteeDuCombattant(creature('cheval'))).toBeNull();
  });

  it('l’arme tenue porte sa forme à sa main, l’arme rangée au rangement de son trapping', () => {
    const { portees } = porteeDuCombattant(herosArme('arme-simple', 'dague'))!;
    expect(portees.filter((p) => p.cle.champ === 'apparence').map(({ cle, point }) => [cle.id, point])).toEqual([
      [findTrappingById('arme-simple')!.shape!.id, 'main'],
      [findTrappingById('dague')!.shape!.id, findTrappingById('dague')!.rangement!.id],
    ]);
  });

  it('un objet équipé qu’un ensemble habille apporte les pièces de l’ensemble', () => {
    const c = heros();
    c.items = [{ ...objet('heaume'), equipped: true }];
    const { portees } = porteeDuCombattant(c)!;
    expect(portees.filter((p) => p.par?.id === 'heaume').map((p) => p.cle)).toEqual(
      piecesDEnsemble({ type: 'trapping', id: 'heaume' }).map((id) => ({ champ: 'piece', id })),
    );
  });

  it('l’emblème est celui de l’apparence d’auteur', () => {
    const ne = ficheDEntite({ id: 'garde', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, appearance: { embleme: { id: 'taureau-rouge' } } }, () => undefined);
    expect(porteeDuCombattant(ne)!.embleme).toEqual({ id: 'taureau-rouge' });
  });

  it('le sexe est celui de l’apparence ; sans apparence, le corps neutre de la base', () => {
    expect(porteeDuCombattant(heros({ apparence: { sex: 'F' } }))!.sex).toBe('F');
    expect(porteeDuCombattant(heros())!.sex).toBe('M');
  });
});
