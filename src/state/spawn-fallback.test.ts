/**
 * #223 — « seed + repli bruyant » : toute résolution qui ÉCHOUE crie (console) et laisse une trace
 * VISIBLE, jamais un clone silencieux. Une réf. irrésoluble LÈVE (#1882). Couvre l'arme d'authoring hors catalogue (console.error + AUCUNE arme devinée), la garde-robe inconnue
 * (console.warn + citadins). Le tirage individuel des teintes : `gameIso/rig/tirage-individuel.test.tsx`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RefIrresoluble, spawnEnemy } from './spawn';
import { ficheDEntite, FicheAbsente } from './sceneNpc';
import type { SceneEntity } from './scene';
import type { Combatant } from '../engine/types';
import { inFiringBand } from './combatFlow';
import { tenueFor, tenueForClass } from '../gameIso/rig/parts/career';

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
    expect(() => ficheDEntite(ent)).toThrow(FicheAbsente);
    expect(() => ficheDEntite(ent)).toThrow(/personnage « badaud » : « ref », « statblock », « presetId » absents/);
  });

  it('un preset irrésoluble sans autre porteur est dit tel quel', () => {
    const ent = { id: 'baron', kind: 'personnage', pos: POS, presetId: 'preset-inconnu' } as SceneEntity;
    expect(() => ficheDEntite(ent)).toThrow(/preset de PNJ « preset-inconnu » irrésoluble/);
  });

  it('un preset irrésoluble ne retombe JAMAIS sur le statbloc ou la réf. qu’il côtoie', () => {
    const sb = { type: 'statblock', label: 'Statbloc voisin', char: { B: 10 } } as const;
    for (const voisin of [{ ref: 'humain' }, { statblock: sb }]) {
      const ent = { id: 'baron', kind: 'personnage', pos: POS, presetId: 'preset-inconnu', ...voisin } as SceneEntity;
      expect(() => ficheDEntite(ent), JSON.stringify(voisin)).toThrow(/preset de PNJ « preset-inconnu » irrésoluble/);
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

describe('#223/#258 — arme d’authoring (trappingId) au spawn de combat', () => {
  it('trappingId inconnu → console.error, et AUCUNE arme fabriquée depuis l’id (rien d’inventé)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy({ statblock: { type: 'statblock', label: 'PNJ', char: { B: 10 } } }, 'w1', POS, { weapon: 'hache-inconnue' });
    expect(err).toHaveBeenCalledWith(expect.stringContaining('« hache-inconnue »'));
    expect(c.weapons.some((w) => w.label === 'hache-inconnue')).toBe(false);
  });

  it('trappingId de catalogue → aucune plainte, arme COMPLÈTE (Dégâts + Groupe du catalogue)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = spawnEnemy({ statblock: { type: 'statblock', label: 'PNJ', char: { B: 10 } } }, 'w2', POS, { weapon: 'dague' });
    expect(err).not.toHaveBeenCalled();
    const dague = c.weapons.find((w) => w.trappingId === 'dague');
    expect(dague?.damage).toEqual({ plusBF: true, flat: 2 });
    expect(dague?.subType).toBe('base');
  });

  it('#258 régression Olg (loup-et-saumure) — « hache-d-armes » résout SANS plainte au spawn de combat (même voie que le rendu enemyRigProfile)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    spawnEnemy({ statblock: { type: 'statblock', label: 'Olg Blóðsalt', char: { B: 12 } } }, 'olg', POS, { weapon: 'hache-d-armes' });
    expect(err).not.toHaveBeenCalled();
  });

  it('SYMPTÔME — une entité armée d’un `weapon:"arc"` a une cible DANS SA BANDE DE TIR (elle peut tirer)', () => {
    const shooter = spawnEnemy({ ref: 'humain' }, 'archere', { x: 0, y: 0 }, { weapon: 'arc' });
    const cible = spawnEnemy({ ref: 'humain' }, 'cible', { x: 10, y: 0 });
    const arc = shooter.weapons.find((w) => w.type === 'ranged'); // l'arme portée, quelle que soit sa provenance
    expect(arc).toBeDefined();
    expect(arc!.loaded).toBe(true);
    expect(inFiringBand(shooter, cible, arc!)).toBe(true); // 10 cases = 20 m, Portée 50 m
    expect(arc!.trappingId).toBe('arc');
  });
});

describe('#223 — garde-robe inconnue = repli citadins BRUYANT', () => {
  it('id hors catalogue (marchande) → console.warn + tenue de classe Citadins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = tenueFor('marchande');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('marchande'));
    expect(t).toEqual(tenueForClass('citadins'));
  });

  it('LIBELLÉ pris pour un id (Marchand, majuscule) → console.warn + Citadins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = tenueFor('Marchand');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Marchand'));
    expect(t).toEqual(tenueForClass('citadins'));
  });

  it('id de tenue RÉSOLU du catalogue (marchand) → aucun warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tenueFor('marchand');
    expect(warn).not.toHaveBeenCalled();
  });
});
