/**
 * Le DÉ DE TIRAGE d'un document-table (`options.deDeTirage`, `grammaire/document.ts`) : il vit dans le
 * document, et le lecteur le tire de là (`deDeTirageDe`, `src/data/rangees.ts`). #1667
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS_DE_DOCUMENT } from './schemas/validate';
import { META_CHARGE } from './schemas/grammaire/document';
import { deDeTirageDe } from './rangees';
import { formatDice } from '../engine/dice';
import type * as obsessions from './schemas/defs/obsessions';
import type * as miscast from './schemas/defs/miscast';

/** Le dé IMPRIMÉ par le livre pour chaque document-table, à sa réf. */
const LIVRE: Record<string, { die: string; ref: string }> = {
  'artillery-misfire': { die: '1d10', ref: 'AA 10 l.272' },
  'incidents-monte': { die: '1d100', ref: 'EDOC 07 l.150' },
  'problemes-vehicule': { die: '1d100', ref: 'EDOC 07 l.259' },
  'structure-criticals': { die: '1d100', ref: 'AA 10 l.118' },
  obsessions: { die: '2d10', ref: 'EDOC 12 l.172' },
  ivresse: { die: '1d10', ref: 'LDB 09 l.477' },
  'accidents-conduite-attelage': { die: '1d10', ref: 'LDB 09 l.142' },
  'force-des-vents': { die: '1d10', ref: 'LDB 46 l.183' },
  'miscast-mineure': { die: '1d100', ref: 'LDB 46 l.34' },
  'miscast-majeure': { die: '1d100', ref: 'LDB 46 l.58' },
  'miscast-mineure-vdm': { die: '1d100', ref: 'VDM 02 l.218' },
  'miscast-majeure-vdm': { die: '1d100', ref: 'VDM 02 l.243' },
  'miscast-colere': { die: '1d100', ref: 'LDB 40 l.54' },
  'mendier-ennuis': { die: '1d10', ref: 'maison, LDB 09 l.97' },
  'allure-demoniaque-nurgle': { die: '1d10', ref: 'EDOC 13 l.276' },
  'allure-demoniaque-slaanesh': { die: '1d10', ref: 'EDOC 13 l.276' },
  'allure-demoniaque-tzeentch': { die: '1d10', ref: 'EDOC 13 l.276' },
  'allure-demoniaque-indivisible': { die: '1d10', ref: 'EDOC 13 l.276' },
  'contremaitre-lieu': { die: '1d100', ref: 'AA 12 l.70' },
  'contremaitre-objectif': { die: '1d100', ref: 'AA 12 l.96' },
  'contremaitre-personnalite': { die: '1d100', ref: 'AA 12 l.124' },
  'vdm-incantateur-hasardeux-domaine': { die: '1d100', ref: 'VDM 15 l.188' },
  'vdm-siphonnage-de-sort': { die: '1d10', ref: 'VDM 15 l.212' },
  'vdm-marques-arcaniques-lumiere': { die: '1d10', ref: 'VDM 04 l.156' },
  'vdm-marques-arcaniques-metal': { die: '1d10', ref: 'VDM 05 l.142' },
  'vdm-marques-arcaniques-vie': { die: '1d10', ref: 'VDM 06 l.141' },
  'vdm-marques-arcaniques-cieux': { die: '1d10', ref: 'VDM 07 l.142' },
  'vdm-marques-arcaniques-ombres': { die: '1d10', ref: 'VDM 08 l.136' },
  'vdm-marques-arcaniques-mort': { die: '1d10', ref: 'VDM 09 l.136' },
  'vdm-marques-arcaniques-feu': { die: '1d10', ref: 'VDM 10 l.122' },
  'vdm-marques-arcaniques-bete': { die: '1d10', ref: 'VDM 11 l.142' },
  'vdm-maladie-coups-de-poing-maudits': { die: '1d10', ref: 'VDM 12 l.920' },
  'vdm-catastrophes-de-brassage': { die: '1d10', ref: 'VDM 12 l.389' },
  'vdm-symboles-augure': { die: '1d10', ref: 'VDM 03 l.503' },
};

/** Tout document dont la FABRIQUE pose `die` (elle en publie la méta, `META_CHARGE`), lu au disque. */
function documentsADe(): { id: string; die: string }[] {
  return DEFS_DE_DOCUMENT.filter((d) => d.meta?.die === META_CHARGE.die).flatMap((d) => {
    const doc = JSON.parse(readFileSync(join(process.cwd(), d.root, d.file), 'utf8')) as { id: string; die: string } | { id: string; die: string }[];
    return Array.isArray(doc) ? doc : [doc];
  });
}

describe('dé de tirage — en donnée, lu par le lecteur (#1667)', () => {
  it('chaque document-table porte le dé imprimé par le livre, et la table couvre EXACTEMENT ces documents', () => {
    const docs = documentsADe();
    expect(docs.map((d) => d.id).sort(), 'documents à dé de tirage').toEqual(Object.keys(LIVRE).sort());
    for (const d of docs) {
      expect(formatDice(deDeTirageDe<typeof miscast>(docs, d.id)), `${d.id} (${LIVRE[d.id].ref})`).toBe(LIVRE[d.id].die);
    }
  });

  it('le dé se lit VIVANT sur le document, à l’appel', () => {
    const doc = { id: 'fixture', type: 'obsessions', label: 'Fixture', die: '2d10', entries: [] };
    expect(deDeTirageDe<typeof obsessions>(doc)).toEqual({ n: 2, sides: 10 });
    doc.die = 'd100';
    expect(deDeTirageDe<typeof obsessions>(doc)).toEqual({ n: 1, sides: 100 });
  });

  it('un document sans dé est refusé, jamais tiré à un dé par défaut', () => {
    expect(() => deDeTirageDe<typeof obsessions>({ id: 'fixture', type: 'obsessions', label: 'Fixture', entries: [] })).toThrow(/aucun dé de tirage/);
  });
});
