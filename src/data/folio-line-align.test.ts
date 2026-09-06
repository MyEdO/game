import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditAlignment,
  auditDataDir,
  citedEntries,
  folioGoverning,
  folioGoverningWhy,
  parseLineCitation,
} from '../../scripts/guards/lib/folioLineAlign.mjs';
import {
  FOLIO_LINE_ALIGN_NON_JUGEABLE,
  FOLIO_LINE_ALIGN_RATCHET,
} from '../../scripts/guards/lib/folioLineAlignStock.mjs';

/**
 * Garde-fou « le FOLIO déclaré tombe sur la LIGNE citée » (#1318 E8).
 *
 * Une entrée qui porte `source: {book, page}` ET une citation à la ligne (`source.note`, ou son
 * champ `ref` frère) se cite DEUX fois. L'extraction Marker sème des ancres `data-folio` : la ligne
 * citée tombe donc sous une ancre, et cette ancre EST le folio de l'entrée. Divergence = l'une des
 * deux citations ment, et rien ne le montre à la lecture.
 *
 * Complément de `book-source-integrity.test.ts` (voies A/B/C), qui part de la `desc` VERBATIM : les
 * datasets d'ENJEUX (`flow-stakes`, `combat-stakes`, `voyage-stakes`) et le registre des règles
 * optionnelles n'ont pas de `desc` — ils lui sont invisibles, ils ne le sont pas ici.
 *
 * MODE CLIQUET : `FOLIO_LINE_ALIGN_RATCHET` gèle les 41 désalignements restants au 2026-08-20 (43
 * relevés, 2 soldés au même geste). Toute NOUVELLE divergence fait rouge nominativement ; toute
 * entrée du stock qui cesse de diverger doit en être RETIRÉE (second volet).
 *
 * COUVERTURE, pas confiance : sur les 54 folios posés à `reglesOptionnelles.json`, le détecteur en
 * verrouille **52**. Les 2 autres — `vents-tourbillonnants` (`LDB 46 l.179-190`, déclaré 238) et
 * `corruption-tables-edoc` (`EDOC 12 l.63`, déclaré 65) — tombent dans une zone SANS ancre
 * exploitable (`reason: 'queue-trouee'`) : leur folio a été relevé À LA MAIN et n'est pas
 * machine-vérifiable. Ils sont gelés nominativement dans `FOLIO_LINE_ALIGN_NON_JUGEABLE`, et le
 * dernier `it` de ce bloc empêche ce chiffre de dériver en silence.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Plafond du stock, même lecture que `FOLIO_RATCHET_MAX` : il ne monte jamais. */
const RATCHET_MAX = 41;

/** Couverture MESURÉE le 2026-09-01 (après #1457 B2/B3) : `src/data/*.json` porte 4500 entrées à
 *  `source:{book,page}`, dont 1206 citent AUSSI une ligne — 312 jugées ici, 894 écartées (888
 *  hors-forme, 6 queue-trouée). Ces chiffres ne vivaient qu'en commentaire d'en-tête (ici,
 *  `book-source-integrity.test.ts`, `folioIntegrity.mjs`) : ils dérivaient sans un mot. Les deux
 *  bornes ci-dessous les rendent OPPOSABLES, chacune dans son sens. */
const SCANNED_MIN = 312;
// Les 5 stations de `ship-stations.json` et le Trait naval `cale` citent leur LIGNE en `source.note`
// (MDG 13 l.730/714/751, MDG 12 l.303, MSRC 07 l.94) : elles entrent au numérateur des CITÉES.
const SANS_CITATION_MAX = 3294;

/** Entrées à `source:{book,page}` (SOURCÉES) et celles qui citent AUSSI une ligne (CITÉES), même
 *  règle de lecture que `citedEntries` : `source.note`, à défaut le champ `ref` frère. */
function compteSources(dir: string): { sourcees: number; citees: number } {
  let sourcees = 0;
  let citees = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    const s = rec.source as Record<string, unknown> | undefined;
    if (s && typeof s === 'object' && !Array.isArray(s) && typeof s.book === 'string' && typeof s.page === 'number') {
      sourcees++;
      if (typeof s.note === 'string' || typeof rec.ref === 'string') citees++;
    }
    for (const [k, v] of Object.entries(rec)) if (k !== 'source') walk(v);
  };
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    walk(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  return { sourcees, citees };
}

describe('garde-fou « folio déclaré ↔ ligne citée » (cliquet, #1318 E8)', () => {
  const { scanned, violations, ignored } = auditDataDir(DATA_DIR);

  it('aucun désalignement NOUVEAU (hors stock gelé)', () => {
    const nouvelles = violations
      .filter((v) => !FOLIO_LINE_ALIGN_RATCHET.has(v.key))
      .map((v) => `${v.key} : « ${v.cite} » tombe sous data-folio="${v.folio}", source.page dit ${v.page}`);
    expect(
      nouvelles,
      'Folio déclaré et ligne citée se contredisent — RELEVER le passage au `Source/` (marqueur ' +
        `data-folio) et corriger celle des deux qui ment :\n${nouvelles.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute entrée du stock qui ne diverge plus doit en être RETIRÉE', () => {
    const encore = new Set(violations.map((v) => v.key));
    const perimees = [...FOLIO_LINE_ALIGN_RATCHET].filter((k) => !encore.has(k));
    expect(perimees, `Entrée(s) alignée(s) — retirer de FOLIO_LINE_ALIGN_RATCHET :\n${perimees.join('\n')}`).toEqual([]);
    expect(FOLIO_LINE_ALIGN_RATCHET.size).toBeLessThanOrEqual(RATCHET_MAX);
  });

  it('CLIQUET DE COUVERTURE : les entrées JUGÉES ne reculent pas, les entrées SANS citation ne croissent pas (2026-09-01)', () => {
    const { sourcees, citees } = compteSources(DATA_DIR);
    expect(citees, 'le compte de citations diverge de celui de `citedEntries` — la mesure ci-dessous ne porte plus sur la même population').toBe(
      scanned + ignored.length,
    );
    expect(
      scanned,
      `couverture EN RECUL : ${scanned} entrées jugées pour ${SCANNED_MIN} au relevé — une entrée cesse d'être machine-vérifiée sans le dire`,
    ).toBeGreaterThanOrEqual(SCANNED_MIN);
    expect(
      sourcees - citees,
      `entrées sourcées SANS citation à la ligne : ${sourcees - citees} pour ${SANS_CITATION_MAX} au relevé (${sourcees} sourcées, ${citees} citées) — une entrée neuve doit citer sa ligne, pas grossir l'angle mort`,
    ).toBeLessThanOrEqual(SANS_CITATION_MAX);
  });

  it('MESURE : 52 des 54 folios de reglesOptionnelles sont MACHINE-vérifiés, les 2 autres sont nommés', () => {
    expect(scanned).toBeGreaterThan(200);
    const regles = violations.filter((v) => v.file === 'reglesOptionnelles.json');
    expect(regles, `reglesOptionnelles.json doit rester à ZÉRO désalignement :\n${regles.map((v) => v.key).join('\n')}`).toEqual([]);

    const nonJugees = ignored
      .filter((i) => i.file === 'reglesOptionnelles.json' && i.reason !== 'hors-forme')
      .map((i) => i.key);
    expect(new Set(nonJugees)).toEqual(
      new Set([...FOLIO_LINE_ALIGN_NON_JUGEABLE].filter((k) => k.startsWith('reglesOptionnelles.json#'))),
    );
    expect(nonJugees).toHaveLength(2); // 54 posés − 52 vérifiés
  });

  it('COUVERTURE : aucune entrée n\'est jugée depuis un span à TROU, et les non-jugeables sont ceux du stock', () => {
    const trous = ignored.filter((i) => i.reason === 'span-a-trou').map((i) => `${i.key} (« ${i.cite} »)`);
    expect(
      trous,
      'Entrée(s) citant une ligne dans un span sans ancre intermédiaire — le folio n\'y est PAS ' +
        `mesurable : les geler dans FOLIO_LINE_ALIGN_NON_JUGEABLE :\n${trous.join('\n')}`,
    ).toEqual([]);

    const nonJugeables = ignored.filter((i) => i.reason !== 'hors-forme').map((i) => i.key).sort();
    expect(nonJugeables, 'La liste des entrées non jugeables a bougé — mettre FOLIO_LINE_ALIGN_NON_JUGEABLE au réel').toEqual(
      [...FOLIO_LINE_ALIGN_NON_JUGEABLE].sort(),
    );
  });
});

describe('mécanique de mesure (PURE) — `folioLineAlign.mjs`', () => {
  it('parseLineCitation reconnaît les formes réelles du dépôt, et refuse le reste', () => {
    expect(parseLineCitation('LDB 12 l.28/32')).toEqual({ abbr: 'LDB', chapter: 12, line: 28 });
    expect(parseLineCitation('ADE II 09 l.3')).toEqual({ abbr: 'ADE II', chapter: 9, line: 3 });
    expect(parseLineCitation('AA 07 l.1-185')).toEqual({ abbr: 'AA', chapter: 7, line: 1 });
    expect(parseLineCitation('MDG 15 p.131')).toBeNull(); // citation au FOLIO, pas à la ligne
    expect(parseLineCitation('EDOC 12')).toBeNull(); // chapitre seul
    expect(parseLineCitation(42)).toBeNull();
  });

  it('folioGoverning REPORTE le folio ouvert au chapitre précédent quand la ligne le précède', () => {
    const ch = (n: number) =>
      ({
        1: ['a', '<span data-folio="9"></span>', 'b'],
        2: ['déborde du folio 9', '<span data-folio="10"></span>', 'c'],
      })[n] ?? null;
    expect(folioGoverning(ch, 2, 1)).toBe(9); // avant la 1re ancre du ch.2 → report du ch.1
    expect(folioGoverning(ch, 2, 3)).toBe(10);
  });

  it('folioGoverning REFUSE de trancher au-delà de la dernière ancre quand le voisin ne la CONTINUE pas', () => {
    // Le ch.1 s'arrête au folio 9, le ch.2 ouvre au folio 20 : les folios 10-19 n'ont pas d'ancre.
    const troue = (n: number) =>
      ({
        1: ['a', '<span data-folio="9"></span>', 'zone non bornée'],
        2: ['<span data-folio="20"></span>', 'c'],
      })[n] ?? null;
    expect(folioGoverningWhy(troue, 1, 3)).toEqual({ folio: null, reason: 'queue-trouee' });
    expect(folioGoverningWhy(troue, 2, 1)).toEqual({ folio: 20, reason: 'ok' }); // bornée à gauche par sa propre ancre
  });

  it('folioGoverning REFUSE de trancher dans un trou INTÉRIEUR (ancre 150 puis 153 : 151/152 sans ancre)', () => {
    // Sonde du juge E8 : la version « refus en queue seulement » répondait 150 pour la ligne 5,
    // alors que le span 150→153 porte TROIS folios imprimés et que rien ne dit lequel.
    const interieur = (n: number) =>
      ({
        1: [
          'préambule',
          '<span data-folio="150"></span>', // l.2
          'a',
          'b',
          'la ligne citée — sur 150, 151 ou 152 ? indécidable', // l.5
          'c',
          'd',
          'e',
          'f',
          '<span data-folio="153"></span>', // l.10
          'après',
        ],
        2: ['<span data-folio="154"></span>'],
      })[n] ?? null;
    expect(folioGoverningWhy(interieur, 1, 5)).toEqual({ folio: null, reason: 'span-a-trou' });
    // Le span qui ENCHAÎNE (153 → 154) reste jugeable : le refus ne mange pas les cas sains.
    expect(folioGoverningWhy(interieur, 1, 11)).toEqual({ folio: 153, reason: 'ok' });
  });

  it('folioGoverning tranche un span borné des deux côtés par des ancres CONTIGUËS', () => {
    const sain = (n: number) =>
      ({
        1: ['<span data-folio="150"></span>', 'la règle', '<span data-folio="151"></span>', 'suite'],
        2: ['<span data-folio="152"></span>'],
      })[n] ?? null;
    expect(folioGoverningWhy(sain, 1, 2)).toEqual({ folio: 150, reason: 'ok' });
    expect(folioGoverningWhy(sain, 1, 4)).toEqual({ folio: 151, reason: 'ok' });
  });

  it('citedEntries ne retient que les entrées portant À LA FOIS `source` et une citation', () => {
    const data = [
      { id: 'avec-note', source: { book: 'livre-de-base', page: 1, note: 'LDB 12 l.28' } },
      { id: 'avec-ref', ref: 'LDB 12 l.28', source: { book: 'livre-de-base', page: 1 } },
      { id: 'sans-citation', source: { book: 'livre-de-base', page: 1 } },
      { id: 'sans-source', ref: 'LDB 12 l.28' },
    ];
    expect(citedEntries(data, 'fixture.json').map((e) => e.id)).toEqual(['avec-note', 'avec-ref']);
  });

  it('MORSURE : un folio faux fait rouge, le folio mesuré fait vert (même entrée)', () => {
    const chapitre = ['# titre', '<span data-folio="150"></span>', 'la règle', '<span data-folio="151"></span>'];
    const lines = (abbr: string, ch: number) => (abbr === 'LDB' && ch === 12 ? chapitre : null);
    const abbrOf = () => 'LDB';
    const entry = (page: number) => [
      { file: 'fixture.json', id: 'r', book: 'livre-de-base', page, cite: 'LDB 12 l.3' },
    ];
    expect(auditAlignment(entry(150), abbrOf, lines).violations).toEqual([]);
    const rouge = auditAlignment(entry(149), abbrOf, lines).violations;
    expect(rouge).toHaveLength(1);
    expect(rouge[0]).toMatchObject({ key: 'fixture.json#r', page: 149, folio: 150 });
  });
});
