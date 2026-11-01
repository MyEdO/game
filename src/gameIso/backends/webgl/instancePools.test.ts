/**
 * COMPTE D'INSTANCES d'un pool — trois faits : la couture retire du rendu un pool vide, les trois
 * familles de pools du monde (marques, marques dynamiques + leur jumeau, halos) passent bien par elle
 * (au montage comme à la repose par frame), et AUCUN autre site de `src/gameIso` n'écrit un `count` de
 * maillage à la main hors des foyers déclarés ci-dessous.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import * as THREE from 'three';
import { poserCompteInstances } from './instancePools';
import { buildHighlightMesh, writeHighlightInstances } from './highlightMeshes';
import { buildDynamicMarkMesh, buildSilhouetteTwin } from './dynamicMarkMeshes';
import { buildHaloMesh } from './interactHaloMeshes';
import { poseDynamicMarks } from '../../stage/dynamicMarkPose';
import { poseInteractHalos } from '../../stage/interactHaloPose';
import type { HighlightEl } from '../../builders/highlights';
import type { DynamicMarks, TeamRing } from '../../builders/dynamicMarks';
import type { InteractHalo } from '../../builders/interactHalos';
import { HERO_RING } from '../../teamColors';

const MPT = 2;
const PLAT = () => 0;
const CADRE = { mpt: MPT, glide: () => null, groundM: PLAT, kind: 'iso' as const };
const AUCUNE_MARQUE: DynamicMarks = { tethers: [], active: null, party: null, rings: [] };
const ANNEAU: TeamRing = { id: 'h1', cell: { x: 2, y: 3, z: 0 }, rK: 0.4, color: HERO_RING[0], dash: '5 3' };

const CASE: HighlightEl = { key: 'w:3,2', cell: { x: 3, y: 2, z: 0 }, h: 0, kind: 'walk' };

const UTILISABLE: InteractHalo = {
  id: 'coffre',
  cell: { x: 3, y: 4, z: 0 },
  n: 1,
  scaleK: 1,
  span: { w: 1, h: 1 },
  centre: { x: 3, y: 4 },
  echelle: { x: 1, y: 1 },
  etat: 'revele',
  visible: true,
};

describe('poserCompteInstances', () => {
  it('un pool à ZÉRO instance sort du rendu ; un pool peuplé y revient', () => {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), 8);
    poserCompteInstances(mesh, 0);
    expect(mesh.count).toBe(0);
    expect(mesh.visible).toBe(false);
    poserCompteInstances(mesh, 3);
    expect(mesh.count).toBe(3);
    expect(mesh.visible).toBe(true);
  });
});

describe('les pools du monde passent par la couture', () => {
  it('marques : montée invisible, visible dès la première écriture, invisible quand la liste se vide', () => {
    const mesh = buildHighlightMesh('walk', 8);
    expect(mesh.visible).toBe(false);
    writeHighlightInstances(mesh, [CASE], MPT);
    expect(mesh.count).toBe(1);
    expect(mesh.visible).toBe(true);
    writeHighlightInstances(mesh, [], MPT);
    expect(mesh.count).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it('marques dynamiques : le pool ET son jumeau de silhouette suivent le compte de la pose', () => {
    const anneau = buildDynamicMarkMesh('anneau');
    const jumeau = buildSilhouetteTwin(anneau);
    expect(anneau.visible).toBe(false);
    expect(jumeau.visible).toBe(false);
    const n = poseDynamicMarks({ anneau }, { ...AUCUNE_MARQUE, rings: [ANNEAU] }, CADRE);
    expect(n.anneau).toBeGreaterThan(0);
    expect(anneau.visible).toBe(true);
    expect(jumeau.count).toBe(anneau.count);
    expect(jumeau.visible).toBe(true);
    poseDynamicMarks({ anneau }, AUCUNE_MARQUE, CADRE);
    expect(anneau.count).toBe(0);
    expect(anneau.visible).toBe(false);
    expect(jumeau.visible).toBe(false);
  });

  it('halos : monté invisible, visible dès qu’un utilisable est révélé, invisible quand il se tait', () => {
    const pool = buildHaloMesh('haloDisque');
    const frame = { mpt: MPT, groundM: PLAT, kind: 'iso' as const, yawDeg: 0, camQuat: new THREE.Quaternion(), tSec: 0 };
    expect(pool.visible).toBe(false);
    poseInteractHalos({ haloDisque: pool }, [UTILISABLE], frame);
    expect(pool.count).toBeGreaterThan(0);
    expect(pool.visible).toBe(true);
    poseInteractHalos({ haloDisque: pool }, [], frame);
    expect(pool.count).toBe(0);
    expect(pool.visible).toBe(false);
  });
});

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url)); // …/backends/webgl/ → racine du dépôt
const SCAN_DIRS = ['src/gameIso'];

/**
 * FOYERS de `count` — les seuls sites qui écrivent un compte hors de la couture, avec leur raison.
 * Un fichier listé ici DOIT porter au moins un site (vérifié) : une exemption qui ne sert plus se
 * retire, elle ne dort pas.
 */
const FOYERS: readonly { readonly fichier: string; readonly raison: string }[] = [
  {
    fichier: 'src/gameIso/backends/webgl/instancePools.ts',
    raison: 'la couture elle-même',
  },
  {
    fichier: 'src/gameIso/backends/webgl/groundAccents.ts',
    raison: 'pool d’accents de sol : matériau OPAQUE et porteur d’ombre, il ne paie pas la double passe',
  },
  {
    fichier: 'src/gameIso/backends/webgl/weatherParticles.ts',
    raison: 'compte de MONTAGE du semis (`field.n`), fixé une fois pour la vie du champ',
  },
];

/**
 * Les écritures `<maillage>.count = …` d'une source.
 *
 * La forme retenue exige un RÉCEPTEUR NOMMÉ (`mesh.count`, `this.pool.count`) : `groups[i].count`
 * — le compte d'un groupe de `BufferGeometry`, qui n'est pas un pool (`sceneMeshes.ts`) — est exclu
 * STRUCTURELLEMENT, par le crochet fermant qui précède le point.
 *
 * ANGLE MORT énoncé : scan TEXTUEL, périmètre `src/gameIso/**` hors tests. Un compte écrit par
 * destructuration, par `Object.assign`, ou derrière un alias de propriété lui échappe.
 */
export function scanEcrituresDeCompte(src: string): string[] {
  return src
    .split('\n')
    .filter((l) => /(?:^|[^\w$.\])])[\w$]+(?:\.[\w$]+)*\.count\s*=(?!=)/.test(l))
    .map((l) => l.trim());
}

describe('garde — le compte d’un pool passe par la couture', () => {
  it('aucune écriture de `count` hors des foyers déclarés', () => {
    const exemptés = new Set(FOYERS.map((f) => f.fichier));
    const fautifs: string[] = [];
    for (const { rel, text } of readCorpus(SCAN_DIRS)) {
      if (exemptés.has(rel)) continue;
      for (const site of scanEcrituresDeCompte(text)) fautifs.push(`${rel} : ${site}`);
    }
    expect(
      fautifs,
      `Router par poserCompteInstances (src/gameIso/backends/webgl/instancePools.ts) :\n${fautifs.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque foyer déclaré porte bien un site — sinon son exemption est morte', () => {
    for (const { fichier, raison } of FOYERS) {
      const sites = scanEcrituresDeCompte(readFileSync(join(ROOT, fichier), 'utf8'));
      expect(sites.length, `${fichier} (${raison})`).toBeGreaterThan(0);
    }
  });

  it('fail-closed sur une écriture SYNTHÉTIQUE ; muet sur un compte de GROUPE de géométrie', () => {
    expect(scanEcrituresDeCompte('  mesh.count = n;')).toHaveLength(1);
    expect(scanEcrituresDeCompte('  this.pools.halos.count = 0;')).toHaveLength(1);
    expect(scanEcrituresDeCompte('  groups[groupe].count = écrit - début;')).toEqual([]);
    expect(scanEcrituresDeCompte('  const n = Math.min(els.length, mesh.instanceMatrix.count);')).toEqual([]);
    expect(scanEcrituresDeCompte('  if (mesh.count === 0) return;')).toEqual([]);
  });
});
