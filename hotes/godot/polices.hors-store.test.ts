/**
 * LES POLICES DE L'HÔTE GODOT (#3498) : l'autoload `Police` (`projet/scripts/police.gd`) pose en police par défaut du
 * thème celle de `projet/art/police.tres`, sa base puis ses replis dans l'ordre ; celles des titres
 * (`projet/art/police_des_titres.tres`) et des rubriques (`projet/art/police_des_rubriques.tres`) ont les mêmes replis. Dans chaque chaîne, chaque caractère du catalogue de messages
 * français (`src/i18n/messages/fr.ts`) a son glyphe dans l'une d'elles, lu dans la table `cmap` du fichier livré ; chaque
 * fichier de `projet/polices/` a l'empreinte que sa provenance déclare.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fr } from '../../src/i18n/messages/fr';

const PROJET = new URL('./projet/', import.meta.url);
const lire = (chemin: string): Buffer => readFileSync(new URL(chemin.replace(/^res:\/\//, ''), PROJET));

/** Le décalage de la table `etiquette` d'une police (OpenType, « Table Directory »). */
function table(police: Buffer, etiquette: string): number {
  const entree = Array.from({ length: police.readUInt16BE(4) }, (_, i) => 12 + 16 * i).find((r) => police.toString('latin1', r, r + 4) === etiquette);
  if (entree === undefined) throw new Error(`police sans table ${etiquette}`);
  return police.readUInt32BE(entree + 8);
}

/** L'ascendante et la descendante (`hhea`) d'une police, en fraction de son cadratin (`head.unitsPerEm`). */
function metriques(police: Buffer): { ascendante: number; descendante: number } {
  const em = police.readUInt16BE(table(police, 'head') + 18);
  const hhea = table(police, 'hhea');
  return { ascendante: police.readInt16BE(hhea + 4) / em, descendante: -police.readInt16BE(hhea + 6) / em };
}

/** Les points de code qu'une police TrueType associe à un glyphe non nul : sous-tables `cmap` de format 4 et 12
 *  (OpenType, « cmap — Character to Glyph Index Mapping Table »). */
function pointsDeCode(police: Buffer): Set<number> {
  const cmap = table(police, 'cmap');
  const points = new Set<number>();
  for (let i = 0; i < police.readUInt16BE(cmap + 2); i++) {
    const sous = cmap + police.readUInt32BE(cmap + 8 + 8 * i);
    const format = police.readUInt16BE(sous);
    if (format === 4) {
      const segments = police.readUInt16BE(sous + 6) / 2;
      const fins = sous + 14, debuts = fins + 2 * segments + 2, deltas = debuts + 2 * segments, decalages = deltas + 2 * segments;
      for (let s = 0; s < segments; s++) {
        const debut = police.readUInt16BE(debuts + 2 * s), fin = police.readUInt16BE(fins + 2 * s);
        const delta = police.readInt16BE(deltas + 2 * s), decalage = police.readUInt16BE(decalages + 2 * s);
        for (let c = debut; c <= fin && c !== 0xffff; c++) {
          const brut = decalage ? police.readUInt16BE(decalages + 2 * s + decalage + 2 * (c - debut)) : c;
          if (decalage ? brut !== 0 : ((brut + delta) & 0xffff) !== 0) points.add(c);
        }
      }
    } else if (format === 12) {
      for (let g = 0; g < police.readUInt32BE(sous + 12); g++) {
        const groupe = sous + 16 + 12 * g;
        for (let c = police.readUInt32BE(groupe); c <= police.readUInt32BE(groupe + 4); c++) points.add(c);
      }
    }
  }
  return points;
}

/** Les fichiers d'une police (`FontVariation`) de `art/`, sa base puis ses replis, dans l'ordre de son fichier. */
const chaineDe = (police: string) => [...lire(police).toString('utf8').matchAll(/^\[ext_resource type="FontFile" path="([^"]+)"/gm)].map((m) => m[1]);
const POLICES = ['art/police.tres', 'art/police_des_titres.tres', 'art/police_des_rubriques.tres'];
const chaine = chaineDe('art/police.tres');

const textes: string[] = [];
const parcourir = (v: unknown): void => {
  if (typeof v === 'string') textes.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(parcourir);
};
parcourir(fr);

describe('la police de l’hôte Godot (#3498)', () => {
  it('l’autoload `Police` la pose en police par défaut du thème, une base et ses replis', () => {
    expect(lire('project.godot').toString('utf8')).toMatch(/^Police="\*res:\/\/scripts\/police\.gd"$/m);
    expect(lire('scripts/police.gd').toString('utf8')).toContain('ThemeDB.get_project_theme().default_font = load("res://art/police.tres")');
    expect(chaine.length, 'base et replis').toBeGreaterThan(1);
  });

  it.each(POLICES)('chaque caractère des messages français a son glyphe dans la chaîne de %s', (police) => {
    const couverts = new Set(chaineDe(police).flatMap((chemin) => [...pointsDeCode(lire(chemin))]));
    const caracteres = new Set([...textes.join('')].map((c) => c.codePointAt(0)!).filter((c) => c >= 0x20));
    expect(caracteres.size, 'balayage suspect').toBeGreaterThan(100);
    const manquants = [...caracteres].filter((c) => !couverts.has(c)).map((c) => `${String.fromCodePoint(c)} U+${c.toString(16).toUpperCase().padStart(4, '0')}`);
    expect(manquants, `caractères sans glyphe : élargir un repli de projet/${police}`).toEqual([]);
  });

  it.each(POLICES)('aucun repli de %s ne dépasse la base en hauteur : Godot prend la plus haute de la chaîne pour la ligne', (police) => {
    const [base, ...replis] = chaineDe(police).map((chemin) => ({ chemin, ...metriques(lire(chemin)) }));
    for (const repli of replis) {
      expect(repli.ascendante, repli.chemin).toBeLessThanOrEqual(base.ascendante + 1e-3);
      expect(repli.descendante, repli.chemin).toBeLessThanOrEqual(base.descendante + 1e-3);
    }
  });

  it('chaque fichier des polices a l’empreinte de sa provenance', () => {
    const provenance = JSON.parse(lire('polices/provenance.json').toString('utf8')) as Record<string, { sha256: string }>;
    expect([...new Set(POLICES.flatMap(chaineDe))].map((chemin) => chemin.replace('res://polices/', '')).sort()).toEqual(Object.keys(provenance).sort());
    for (const [fichier, { sha256 }] of Object.entries(provenance))
      expect(createHash('sha256').update(lire(`polices/${fichier}`)).digest('hex'), fichier).toBe(sha256);
  });

  it('le projet s’importe sur un seul fil, les polices comprises (#3951)', () => {
    expect(lire('project.godot').toString('utf8')).toMatch(/^import\/use_multiple_threads=false$/m);
  });
});
