/**
 * #223 — « seed + repli bruyant » : toute résolution qui ÉCHOUE crie (console) et laisse une trace
 * VISIBLE, jamais un clone silencieux. Une réf. irrésoluble LÈVE (#1882).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RefIrresoluble, spawnEnemy } from '../noyau/monde/spawn';
import { ficheDEntite, FicheAbsente } from '../noyau/monde/sceneNpc';
import type { SceneEntity } from '../noyau/monde/scene';
import type { Combatant } from '../engine/types';
import { inFiringBand } from '../noyau/combatFlow';
import { weaponLoaded } from '../engine/weaponLoad';
import { presetPnjById } from './campaignData';

const POS = { x: 0, y: 0 };
afterEach(() => vi.restoreAllMocks());

describe('#1882 — aucune fiche sans porteur : ni profil de repli, ni PNJ générique', () => {
  it('le spawn EXIGE un porteur de fiche : l’absence ne se type pas', () => {
    // @ts-expect-error — `PorteurDeFiche` n'a aucune variante vide (#1882).
    const sansPorteur = (): Combatant => spawnEnemy({}, 'x1', POS);
    expect(sansPorteur).toBeTypeOf('function');
  });

  it('une entité sans porteur qui franchit la porte est un BOGUE, dit par `FicheAbsente` en nommant l’entité', () => {
    const ent = { id: 'badaud', kind: 'personnage', pos: POS, label: 'Badaud', appearance: { species: 'humains-reiklander' } } as SceneEntity;
    expect(() => ficheDEntite(ent, presetPnjById)).toThrow(FicheAbsente);
    expect(() => ficheDEntite(ent, presetPnjById)).toThrow(/personnage « badaud » : « creature », « vehicule », « engin », « statblock », « presetId » absents/);
  });

  it('un preset irrésoluble sans autre porteur est dit tel quel', () => {
    const ent = { id: 'baron', kind: 'personnage', pos: POS, presetId: 'preset-inconnu' } as SceneEntity;
    expect(() => ficheDEntite(ent, presetPnjById)).toThrow(/preset de PNJ « preset-inconnu » irrésoluble/);
  });

  it('un preset irrésoluble ne retombe JAMAIS sur le statbloc ou le corps qu’il côtoie', () => {
    const sb = { type: 'statblock', label: 'Statbloc voisin', char: { B: 10 } } as const;
    for (const voisin of [{ creature: { id: 'humain' } }, { statblock: sb }]) {
      const ent = { id: 'baron', kind: 'personnage', pos: POS, presetId: 'preset-inconnu', ...voisin } as SceneEntity;
      expect(() => ficheDEntite(ent, presetPnjById), JSON.stringify(voisin)).toThrow(/preset de PNJ « preset-inconnu » irrésoluble/);
    }
  });
});

describe('#1882 — réf. irrésoluble : aucun mannequin, le spawn LÈVE', () => {
  it('réf. bidon ou vide → `RefIrresoluble` nommant la réf. et l’entité, jamais un Combatant', () => {
    for (const ref of ['creature-fantome-xyz', '']) {
      expect(() => spawnEnemy({ ref }, 'x2', POS), ref).toThrow(RefIrresoluble);
      expect(() => spawnEnemy({ ref }, 'x2', POS), ref).toThrow(`« ${ref} » (entité « x2 »)`);
    }
  });

  it('réf. VALIDE → la fiche du bestiaire (contrôle)', () => {
    expect(spawnEnemy({ ref: 'humain' }, 'x3', POS).label).toBe('Humain');
  });
});

describe('#3684 — objets d’inventaire d’auteur au spawn de combat', () => {
  it('une arme du catalogue devient un objet du porteur et son arme COMPLÈTE (Dégâts + Groupe du catalogue)', () => {
    const c = spawnEnemy({ statblock: { type: 'statblock', label: 'PNJ', char: { B: 10 } } }, 'w2', POS, { inventaire: { dague: false } });
    const dague = c.weapons.find((w) => w.trappingId === 'dague');
    expect(c.items?.map((i) => i.uid)).toEqual(['w2-objet-dague']);
    expect(dague).toMatchObject({ uid: 'w2-objet-dague', damage: { plusBF: true, flat: 2 }, subType: 'base' });
  });

  it('une entité armée d’un arc d’inventaire a une cible DANS SA BANDE DE TIR (elle peut tirer)', () => {
    const shooter = spawnEnemy({ ref: 'humain' }, 'archere', { x: 0, y: 0 }, { inventaire: { arc: false } });
    const cible = spawnEnemy({ ref: 'humain' }, 'cible', { x: 10, y: 0 });
    const arc = shooter.weapons.find((w) => w.type === 'distance');
    expect(arc?.trappingId).toBe('arc');
    expect(weaponLoaded(shooter, arc!)).toBe(true);
    expect(inFiringBand(null, shooter, cible, arc!)).toBe(true); // 10 cases = 20 m, Portée 50 m
  });
});
