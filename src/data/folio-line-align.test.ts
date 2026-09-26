import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import {
  FOLIO_LINE_ALIGN_NON_JUGEABLE,
  FOLIO_LINE_ALIGN_RATCHET,
} from '../../scripts/guards/lib/folioLineAlignStock.mjs';
import {
  auditFolioLineAlign,
  citationsParCle,
  DOSSIER_DATA,
  sitesDesNonJugeables,
  sitesDesViolations,
} from '../../scripts/guards/lib/folioLineAlignAudit';
import { ecartDuVolet } from '../../scripts/guards/lib/stock.mjs';

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
 * MODE CLIQUET : `FOLIO_LINE_ALIGN_RATCHET` gèle les désalignements restants en entrées
 * `{ fichier, ref, occurrence }` (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`) — la forme que la
 * porte de plage VOIT, et qui se passe de plafond : une entrée de plus se déclare par son `fichier`.
 * Toute NOUVELLE divergence fait rouge nominativement ; toute entrée qui cesse de diverger SORT du
 * stock à la régénération (`npx tsx scripts/data/regen-folio-line-align-stock.mts`, second volet).
 *
 * COUVERTURE, pas confiance : sur les 54 folios posés à `reglesOptionnelles.json`, le détecteur en
 * verrouille **52**. Les 2 autres — `vents-tourbillonnants` (`LDB 46 l.179-190`, déclaré 238) et
 * `corruption-tables-edoc` (`EDOC 12 l.63`, déclaré 65) — tombent dans une zone SANS ancre
 * exploitable (`reason: 'queue-trouee'`) : leur folio a été relevé À LA MAIN et n'est pas
 * machine-vérifiable. Ils sont gelés nominativement dans `FOLIO_LINE_ALIGN_NON_JUGEABLE`, et le
 * dernier `it` de ce bloc empêche ce chiffre de dériver en silence.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Couverture MESURÉE le 2026-09-24 (#1473, même mesure que `book-source-integrity.test.ts` et
 *  `folioIntegrity.mjs`) : `src/data/*.json` porte 4472 entrées à `source:{book,page}`, dont 1310
 *  citent AUSSI une ligne — 495 jugées ici, 815 écartées (807 hors-forme, 8 queue-trouée), soit 11,1 %
 *  des folios vérifiés machine par cette voie. Les deux bornes ci-dessous rendent ces chiffres
 *  OPPOSABLES, chacune dans son sens, sans marge : la prochaine entrée sourcée SANS citer sa ligne fait
 *  rouge, comme la prochaine entrée qui cesse d'être jugée. */
const SCANNED_MIN = 495;
const SANS_CITATION_MAX = 3162; // 4472 sourcées − 1310 citées.

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
  for (const f of listerDossier(dir).filter((x) => x.endsWith('.json'))) {
    walk(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  return { sourcees, citees };
}

const STOCK = 'scripts/guards/lib/folioLineAlignStock.mjs';
const REGEN = 'npx tsx scripts/data/regen-folio-line-align-stock.mts';

describe('garde-fou « folio déclaré ↔ ligne citée » (cliquet, #1318 E8)', () => {
  const { scanned, violations, ignored } = auditFolioLineAlign();
  const ecartDesalignes = ecartDuVolet({
    sites: sitesDesViolations(violations), stock: FOLIO_LINE_ALIGN_RATCHET, ou: STOCK,
  });
  const ecartNonJugeables = ecartDuVolet({
    sites: sitesDesNonJugeables(ignored), stock: FOLIO_LINE_ALIGN_NON_JUGEABLE, ou: STOCK,
  });

  /** La citation et les DEUX folios, RENDUS depuis le disque du jour — le stock ne les grave pas
   *  (une copie gelée dirait le folio d'hier après une ré-extraction Marker). */
  const citations = citationsParCle(violations);
  const avecCitation = (lignes: readonly string[]) =>
    lignes.map((l) => {
      const cite = [...citations].find(([cle]) => l.includes(`${cle} ::`))?.[1];
      return cite ? `${l}\n      ${cite}` : l;
    });

  it('aucun désalignement NOUVEAU (hors stock gelé)', () => {
    const nouvelles = avecCitation(ecartDesalignes.neuves);
    expect(
      nouvelles,
      'Folio déclaré et ligne citée se contredisent — RELEVER le passage au `Source/` (marqueur ' +
        `data-folio) et corriger celle des deux qui ment :\n${nouvelles.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute entrée du stock qui ne diverge plus doit en être RETIRÉE', () => {
    const { perimees } = ecartDesalignes;
    expect(perimees, `Entrée(s) alignée(s) — régénérer (${REGEN}) :\n${perimees.join('\n')}`).toEqual([]);
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
      .map((i) => i.id);
    expect(new Set(nonJugees)).toEqual(
      new Set(FOLIO_LINE_ALIGN_NON_JUGEABLE
        .filter((e) => e.fichier === `${DOSSIER_DATA}/reglesOptionnelles.json`)
        .map((e) => e.ref)),
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

    const bouge = [...ecartNonJugeables.neuves, ...ecartNonJugeables.perimees];
    expect(bouge, `La liste des entrées non jugeables a bougé — régénérer (${REGEN}) :\n${bouge.join('\n')}`).toEqual([]);
  });
});
