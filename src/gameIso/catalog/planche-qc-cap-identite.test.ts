/**
 * PLANCHE QC DU MOBILIER VOLUMIQUE — elle peint la recette au CAP D'IDENTITÉ, celui-là même qu'une
 * scène montre pour une instance SANS cap (#1680 ligne 16).
 *
 * L'outil de QC est un ŒIL : s'il peint à un autre cap que le repère d'auteur, il montre chaque décor
 * tourné par rapport à ce que la donnée écrit ET à ce que le monde rend — et l'auteur corrige d'après
 * une image fausse. Le défaut mesuré : `ancrageDePlanche` portait `facing: 'N'`, cap d'identité
 * d'AVANT ce lot, donc un demi-tour ; la serrure du `coffre` sortait en `y −0,155` sur la planche
 * contre `y +0,155` en scène.
 *
 * La planche EXPORTE son ancrage (`ancrageDePlanche` — son écriture d'HTML vit derrière `main`) : ce
 * contrat le lit tel que la planche l'emploie. L'artefact committé, lui, doit annoncer le même repère.
 *
 * Une clause reste sur le TEXTE SOURCE de la planche, faute d'autre instrument : le cap d'identité VAUT
 * aujourd'hui `S`, donc un site qui écrit `'S'` en dur rend exactement le même pixel qu'un site qui lit
 * la constante — aucune mesure de comportement ne les sépare. Ce que la clause tient, c'est la
 * MIGRATION SUIVANTE : le jour où la constante change, un cap littéral resté en place peint un décor
 * tourné en silence. Elle compte ses sites lus et échoue si elle n'en lit AUCUN (une planche refactorée
 * hors de sa portée ne doit pas la rendre muette).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CAP_IDENTITE_PROP } from '../../data/props.types';
import { findPropById } from '../../data';
import { buildPropVolumes } from '../../noyau/monde/volume/propVolumes';
import { ancrageDePlanche, MPT_DE_PLANCHE } from '../../../scripts/qc/lib/plancheVolumique';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const lire = (rel: string) => readFileSync(join(RACINE, rel), 'utf8');

/** Les SITES DE CAP de la planche : l'argument de cap de `propSvg` (2ᵉ position) et tout champ
 *  `facing:`. Le cap lu est en `m[1]` (appel) ou `m[2]` (champ). */
const SITES_DE_CAP = /\bpropSvg\s*\(\s*[^,()]+,\s*([^,()]+)|\bfacing:\s*([^,}\n]+)/g;
/** Un cap écrit EN DUR — les quatre points cardinaux du monde, entre quotes. */
const CAP_LITTERAL = /^['"][NESO]['"]$/;

describe('planche QC des recettes volumiques — le cap peint est le CAP D’IDENTITÉ', () => {
  it('l’ancrage de planche peint AU cap d’identité, et à l’origine du sol', () => {
    expect(ancrageDePlanche.facing).toBe(CAP_IDENTITE_PROP);
    expect(ancrageDePlanche).toEqual({ ancre: { x: 0, y: 0 }, facing: CAP_IDENTITE_PROP, baseHeightM: 0 });
  });

  it('aucun cap LITTÉRAL dans la planche : tout site de cap prend la constante', () => {
    const src = lire('scripts/qc/lib/plancheVolumique.ts');
    const sites = [...src.matchAll(SITES_DE_CAP)].map((m) => ({
      texte: (m[1] ?? m[2]).trim(),
      ligne: src.slice(0, m.index).split('\n').length,
    }));
    expect(sites.length, 'aucun site de cap lu : cette clause ne mesure plus rien').toBeGreaterThan(0);
    expect(
      sites.filter((s) => CAP_LITTERAL.test(s.texte)).map((s) => `plancheVolumique.ts:${s.ligne} — ${s.texte}`),
    ).toEqual([]);
  });

  it('l’artefact committé annonce le repère courant, jamais un autre', () => {
    const html = lire('public/props-volumiques.html');
    expect(html).toContain(`cap d'identité <code>${CAP_IDENTITE_PROP}</code>`);
    for (const autre of ['N', 'E', 'O'].filter((c) => c !== CAP_IDENTITE_PROP))
      expect(html, `la planche annonce le cap ${autre}`).not.toContain(`cap d'identité <code>${autre}</code>`);
  });

  it('coffre : la planche pose la serrure du côté que la DONNÉE déclare', () => {
    const coffre = findPropById('coffre')!;
    const serrure = coffre.volume!.primitives.find((p) => p.material === 'laiton-dore')!;
    const pts = buildPropVolumes(coffre, ancrageDePlanche, MPT_DE_PLANCHE)
      .filter((f) => f.material.id === 'laiton-dore')
      .flatMap((f) => f.poly);
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const centre = {
      x: r3((Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2),
      y: r3((Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2),
    };
    expect(centre).toEqual({ x: r3(serrure.center.xM), y: r3(serrure.center.yM) });
  });
});
