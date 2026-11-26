import { describe, expect, it } from 'vitest';
import { roofProfileSchema } from '../../data/schemas/defs-scenes/scene';
import { findPropById, matieresDe, props, semencesDeScene, structureAppearances, terrains } from '../../data';
import { parLibelle } from '../../lib/ordre.mjs';
import { PARTS_RELIEF } from '../../data/schemas/materials.types';
import { buildFloors } from './volume/floors';
import { cretesDePerimetre } from './volume/creneaux';
import { echantillonDessine, famillesDEchantillons, sceneDEchantillon, type FamilleDEchantillon } from './echantillons';
import { terrainKitDEscalier } from './terrain';
import { METRES_PER_LEVEL } from './relief';
import { roofMaterial } from './volume/matieres';
import { sceneMetresPerTile } from './scene';

const matieres = (dessine: { surfaces: { matiere: string }[] }): string[] => dessine.surfaces.map((s) => s.matiere);
const matieresDuVolume = (volume: { morceaux: { surfaces: { matiere: string }[] }[] }): string[] => volume.morceaux.flatMap(matieres);
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
    const posees = new Set(matieresDuVolume(echantillonDessine('decor', id).monde).filter((m) => m.startsWith('prop--')));
    expect(posees).toEqual(new Set(findPropById(id)!.volume.primitives.map((p) => `prop--${p.material}`)));
  });

  it.each(entrees('sol'))('le sol %s couvre la scène de sa matière', (id) => {
    expect(matieresDuVolume(echantillonDessine('sol', id).monde)).toContain(`terrain--${id}`);
  });

  it.each(entrees('sol'))('le sol %s à marches porte une volée de trois cases, dont les côtés bordent le sol', (id) => {
    const cotes = echantillonDessine('sol', id).cotesDeMarches;
    if (!terrainKitDEscalier(id)) return expect(cotes).toEqual([]);
    expect(new Set(cotes.map((c) => c.classe))).toEqual(new Set(['rejointe', 'vide']));
    expect(new Set(cotes.map((c) => `${c.case.x},${c.case.y}`)).size, 'les marches de la volée, et son pied').toBe(4);
    expect(cotes.every((c) => c.famille === terrainKitDEscalier(id))).toBe(true);
  });

  it('l’échelle de l’enclos, haute du dénivelé de la case haussée', () => {
    const { aretes } = echantillonDessine('mur', structureAppearances[0].id);
    expect(aretes.filter((a) => a.piece === 'echelle').map((a) => [a.hauteurM, a.pied])).toEqual([[METRES_PER_LEVEL, 0]]);
  });

  it.each(entrees('relief'))('la matière de relief %s habille chaque partie de la terrasse', (id) => {
    const scene = sceneDEchantillon('relief', id);
    const parties = buildFloors(scene, undefined, { activeZ: Math.max(...scene.layers.map((l) => l.z)) })
      .flatMap((el) => el.faces).filter((f) => f.material.domain === 'relief' && f.material.id === id).map((f) => f.material.part);
    expect([...new Set(parties)].sort()).toEqual([...PARTS_RELIEF].sort());
    expect(matieresDuVolume(echantillonDessine('relief', id).monde)).toContain(`relief--${id}`);
  });

  it.each(entrees('toit'))('la matière de toit %s couvre une nappe par profil', (id) => {
    const { toits } = echantillonDessine('toit', id);
    expect(toits).toHaveLength(roofProfileSchema.options.length);
    for (const nappe of toits) expect(matieres(nappe)).toContain(`roof--${id}`);
  });

  it.each(matieresDe('roof').filter((m) => m.couverture).map((m) => m.id))('la couverture %s montre sa faîtière sur le faîte du pignon et de la croupe, et le bardage des pignons (#4471)', (id) => {
    const { piecesDeToit, toits } = echantillonDessine('toit', id);
    expect(new Set(piecesDeToit.map((f) => f.couverture))).toEqual(new Set([id]));
    const faites = piecesDeToit.filter((f) => f.piece === 'faitiere');
    const debord = roofMaterial(id).eaveOverhangM! / sceneMetresPerTile(sceneDEchantillon('toit', id));
    expect(faites.reduce((l, f) => l + Math.hypot(f.sens.x, f.sens.y), 0), 'le faîte du pignon (3 cases et ses deux rives) et celui de la croupe (1)').toBeCloseTo(4 + 2 * debord, 9);
    const pignons = toits.filter((n) => matieres(n).includes(`structure--${semencesDeScene.facade.id}`));
    expect(pignons.length, 'le pignon et l’appentis ferment leur comble').toBe(2);
  });

  it.each(structureAppearances)('l’apparence de mur $id pose chaque pièce de son kit, et sa couronne', (apparence) => {
    const { aretes, couronnes, couronnesAbattues } = echantillonDessine('mur', apparence.id);
    expect(aretes.map((a) => `${a.piece}--${a.position}`).sort()).toEqual([
      'breche--seule', 'echelle--seule', 'fenetre--seule', 'fenetre-close--seule', 'mur--seule', 'mur--seule', 'mur--seule',
      'porte-fermee--droite', 'porte-fermee--gauche', 'porte-fermee--seule', 'porte-ouverte--seule',
    ]);
    expect(aretes.every((a) => a.famille === apparence.kit)).toBe(true);
    expect(couronnes.map((c) => c.cle).sort()).toEqual(apparence.parapet ? aretes.map((a) => a.cle).sort() : []);
    expect(couronnesAbattues).toEqual(apparence.parapet && !apparence.door ? aretes.filter((a) => a.piece === 'breche').map((a) => a.cle) : []);
  });

  it.each(structureAppearances)('l’apparence de mur $id ceint de sa crête, sur ses quatre côtés, une case crénelée si elle a une couronne', (apparence) => {
    const cretes = cretesDePerimetre(sceneDEchantillon('mur', apparence.id));
    expect(new Set(cretes.map(({ arete: { x, y, side } }) => `${x},${y},${side}`)).size).toBe(apparence.parapet ? 4 : 0);
    expect(cretes.every((c) => c.apparence.id === apparence.id)).toBe(true);
    expect(matieresDuVolume(echantillonDessine('mur', apparence.id).monde).includes(`structure--${apparence.id}`)).toBe(apparence.parapet !== undefined);
  });
});
