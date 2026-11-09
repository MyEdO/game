import { describe, expect, it } from 'vitest';
import { roofProfileSchema } from '../../data/schemas/defs-scenes/scene';
import { findPropById, matieresDe, props, structureAppearances, terrains } from '../../data';
import { parLibelle } from '../../lib/ordre.mjs';
import { PARTS_RELIEF } from '../../data/materials.types';
import { buildFloors } from './volume/floors';
import { echantillonDessine, famillesDEchantillons, sceneDEchantillon, type FamilleDEchantillon } from './echantillons';

const matieres = (dessine: { surfaces: { matiere: string }[] }): string[] => dessine.surfaces.map((s) => s.matiere);
const entrees = (famille: FamilleDEchantillon): string[] => famillesDEchantillons().find((f) => f.id === famille)!.entrees.map((e) => e.id);

describe('les échantillons du monde (#3802)', () => {
  it('chaque famille liste chaque entrée de sa donnée', () => {
    expect(famillesDEchantillons().map((f) => [f.id, f.entrees.length])).toEqual([
      ['decor', props.length], ['sol', terrains.filter((t) => !t.absence).length], ['relief', matieresDe('relief').length], ['toit', matieresDe('roof').length], ['mur', structureAppearances.length],
    ]);
  });

  it('chaque famille sert ses entrées dans l’ordre de leurs libellés', () => {
    for (const { entrees: liste } of famillesDEchantillons()) expect(liste.map((e) => e.libelle)).toEqual(liste.map((e) => e.libelle).sort(parLibelle));
  });

  it.each(entrees('decor'))('le décor %s se pose en volume, chaque primitive à sa matière', (id) => {
    const posees = new Set(matieres(echantillonDessine('decor', id).monde).filter((m) => m.startsWith('prop--')));
    expect(posees).toEqual(new Set(findPropById(id)!.volume.primitives.map((p) => `prop--${p.material}`)));
  });

  it.each(entrees('sol'))('le sol %s couvre la scène de sa matière', (id) => {
    expect(matieres(echantillonDessine('sol', id).monde)).toContain(`terrain--${id}`);
  });

  it.each(entrees('relief'))('la matière de relief %s habille chaque partie de la terrasse', (id) => {
    const scene = sceneDEchantillon('relief', id);
    const parties = buildFloors(scene, undefined, { activeZ: Math.max(...scene.layers.map((l) => l.z)) })
      .flatMap((el) => el.faces).filter((f) => f.material.domain === 'relief' && f.material.id === id).map((f) => f.material.part);
    expect([...new Set(parties)].sort()).toEqual([...PARTS_RELIEF].sort());
    expect(matieres(echantillonDessine('relief', id).monde)).toContain(`relief--${id}`);
  });

  it.each(entrees('toit'))('la matière de toit %s couvre une nappe par profil', (id) => {
    const { toits } = echantillonDessine('toit', id);
    expect(toits).toHaveLength(roofProfileSchema.options.length);
    for (const nappe of toits) expect(matieres(nappe)).toContain(`roof--${id}`);
  });

  it.each(structureAppearances)('l’apparence de mur $id pose chaque pièce de son kit, et sa couronne', (apparence) => {
    const { aretes, couronnes, couronnesAbattues } = echantillonDessine('mur', apparence.id);
    expect(aretes.map((a) => a.piece).sort()).toEqual(['breche', 'fenetre', 'fenetre-close', 'mur', 'porte-fermee', 'porte-ouverte']);
    expect(aretes.every((a) => a.famille === apparence.kit)).toBe(true);
    expect(couronnes.map((c) => c.cle).sort()).toEqual(apparence.parapet ? aretes.map((a) => a.cle).sort() : []);
    expect(couronnesAbattues).toEqual(apparence.parapet && !apparence.door ? aretes.filter((a) => a.piece === 'breche').map((a) => a.cle) : []);
  });
});
