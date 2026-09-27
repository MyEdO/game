import { describe, it, expect } from 'vitest';
import { allBuiltinCampaigns } from './campaign';
import { testScenarios } from './test-scenarios';
import { propFootTiles, propDeclaredFoot } from '../state/footprint';
import { sceneMetresPerTile, type Scene, type SceneEntity } from '../state/scene';

/**
 * CONTRAT POSITIF de la migration « l'empreinte vient du TYPE » (#mobilier T1) : une empreinte
 * déclarée dans `props.json` couvre désormais TOUTES ses cases dans TOUTE scène livrée, y compris
 * celles compilées par `MapSpec` — qui posent leurs entités sans passer par l'éditeur et n'ont donc
 * jamais porté d'empreinte d'instance. Personne ne doit naître DANS un décor : ce balayage affirme
 * qu'aucune entité NON-prop (héros, PNJ, ennemi de rencontre expansé par `setEncounters`) ne se tient
 * sur une case couverte par l'empreinte effective d'un prop de la MÊME couche.
 *
 * Élargir le catalogue (`PropData.foot`) ou déplacer un prop dans une scène rejoue ce balayage : c'est
 * le filet qui manquait quand `epave-carrosse` est passée de 1 à 4 cases sous deux mutants d'embuscade.
 */

/** Toutes les scènes LIVRÉES : paquets de campagne intégrés + scénarios de test enregistrés. */
function scenesLivrees(): { source: string; scene: Scene }[] {
  return [
    ...allBuiltinCampaigns.flatMap((c) => c.scenes.map((scene) => ({ source: c.id, scene }))),
    ...testScenarios.map((s) => ({ source: `test-scenarios/${s.id}`, scene: s.scene })),
  ];
}

const zDe = (e: SceneEntity): number => e.z ?? 0;

/** `<source>/<scène>/<entité> sur (x,y,z) — <prop>` pour chaque occupant né dans une empreinte. */
function occupantsDansUnDecor(source: string, scene: Scene): string[] {
  const couverture = new Map<string, string>();
  for (const e of scene.entities ?? []) {
    if (e.kind !== 'prop' || !propDeclaredFoot(e.ref)) continue;
    for (const t of propFootTiles(e.ref, e.pos, e.facing, sceneMetresPerTile(scene))) couverture.set(`${t.x},${t.y},${zDe(e)}`, `${e.ref} (${e.id})`);
  }
  const fautifs: string[] = [];
  for (const e of scene.entities ?? []) {
    if (e.kind === 'prop' || e.kind === 'heroStart') continue; // le décor se superpose ; `heroStart` n'est pas un corps
    const prop = couverture.get(`${e.pos.x},${e.pos.y},${zDe(e)}`);
    if (prop) fautifs.push(`${source}/${scene.id}/${e.id} sur (${e.pos.x},${e.pos.y},${zDe(e)}) — ${prop}`);
  }
  return fautifs;
}

describe('empreinte de TYPE — aucun corps ne naît dans un décor (toutes scènes livrées)', () => {
  const livrees = scenesLivrees();

  it('le balayage porte sur toutes les scènes livrées (campagnes + scénarios de test)', () => {
    expect(livrees.length).toBeGreaterThan(40);
    expect(livrees.some((s) => s.source === 'la-diligence')).toBe(true);
    expect(livrees.some((s) => s.source === 'test-scenarios/embuscade')).toBe(true);
  });

  it('aucune entité NON-prop ne se tient sur une case couverte par l’empreinte d’un prop', () => {
    expect(livrees.flatMap(({ source, scene }) => occupantsDansUnDecor(source, scene))).toEqual([]);
  });

  it('le balayage MORD : un corps posé dans l’empreinte d’un décor est rapporté', () => {
    const scene = {
      id: 'sonde',
      entities: [
        { id: 'epave', kind: 'prop', pos: { x: 4, y: 4 }, ref: 'epave-carrosse' }, // 2×2 : (4,4)…(5,5)
        { id: 'garde', kind: 'personnage', ref: 'humain', pos: { x: 5, y: 5 } },
        { id: 'passant', kind: 'personnage', ref: 'humain', pos: { x: 6, y: 5 } },
      ],
    } as unknown as Scene;
    expect(occupantsDansUnDecor('sonde', scene)).toEqual(['sonde/sonde/garde sur (5,5,0) — epave-carrosse (epave)']);
  });
});
