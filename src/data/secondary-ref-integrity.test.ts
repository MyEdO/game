/**
 * Garde d'ATTESTATION des emplacements SECONDAIRES `alsoIn[]` (#563 Lot 1 item 2). L'ANCRE
 * (`source`) reste vérifiée par `book-source-integrity.test.ts` (règle 5, voie A/B) ; ce module
 * vérifie que chaque `alsoIn[i]` porte une PREUVE POSITIVE (label de l'entrée, ou `quote` authoré)
 * retrouvée dans le SPAN du folio déclaré — charge de la preuve sur l'auteur, jamais une réfutation
 * par absence (doctrine `folioIntegrity.mjs` — un folio de TABLE ne porte pas la desc, `quote`
 * couvre ce cas, ex. `zweihander-flamberge`/`cimeterre`).
 *
 * Lot 2 (#563) a migré 15 entrées réelles (`traits.json`/`qualities.json`/`trappings.json`/
 * `spells.json`/`naval-traits.json`) — les morsures ci-dessous gardent des fixtures SYNTHÉTIQUES
 * pour isoler chaque cas, contre le VRAI corpus `Source/` (jamais des livres inventés), patron déjà
 * établi par `book-source-integrity.test.ts` pour l'ancre.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { auditSecondaries, auditSecondaryRef, secondaryEntriesOf } from '../../scripts/guards/lib/folioIntegrity.mjs';

const DIR = __dirname;
/** Les datasets `.json` de `src/data`, en ordre total — UN listage pour les deux sites qui le lisent. */
const DATASETS = listerDossier(DIR).filter((f) => f.endsWith('.json'));

describe('secondaryEntriesOf — walk de `alsoIn[]`', () => {
  it('collecte chaque emplacement secondaire avec le label du porteur et son propre quote', () => {
    const data = [
      {
        id: 'exemple',
        label: 'Exemple',
        source: { book: 'livre-de-base', page: 1 },
        alsoIn: [{ book: 'zoo-imperial', page: 23, quote: 'une preuve' }],
      },
    ];
    expect(secondaryEntriesOf(data)).toEqual([
      { key: 'exemple.alsoIn[0]', book: 'zoo-imperial', page: 23, label: 'Exemple', quote: 'une preuve' },
    ]);
  });

  it('ignore une entrée sans alsoIn', () => {
    expect(secondaryEntriesOf([{ id: 'x', label: 'X', source: { book: 'livre-de-base', page: 1 } }])).toEqual([]);
  });
});

describe('auditSecondaryRef — attestation POSITIVE (#563 Lot 1 item 2, morsures)', () => {
  it('ATTESTÉ par LABEL : `Fouissement` retrouvé dans le span du folio 23 déclaré (ZI, réel)', () => {
    // ZI 02 - Griffon.md : marqueur data-folio="23" en tête, section "FOUISSEMENT" quelques lignes
    // après, avant le marqueur suivant — span réel, aucun livre inventé.
    const r = auditSecondaryRef({ book: 'zoo-imperial', page: 23, label: 'Fouissement', quote: undefined });
    expect(r.verdict).toBe('attesté');
    expect(r.via).toBe('label');
  });

  it('MORSURE (a) — ni label ni quote dans le span déclaré → non-attesté (rouge)', () => {
    // Folio 1 du ZI existe (dans les bornes), mais ce label fabriqué n'y figure nulle part.
    const r = auditSecondaryRef({ book: 'zoo-imperial', page: 1, label: 'Fouissement-Inexistant-XYZ', quote: undefined });
    expect(r.verdict).toBe('non-attesté');
  });

  it('MORSURE (b) — folio hors bornes du livre → folio-impossible (rouge)', () => {
    const r = auditSecondaryRef({ book: 'zoo-imperial', page: 999999, label: 'Fouissement', quote: undefined });
    expect(r.verdict).toBe('folio-impossible');
    expect(typeof r.max).toBe('number');
  });

  it('MORSURE (c) — quote NON verbatim (mot altéré) → non-attesté (rouge)', () => {
    const r = auditSecondaryRef({
      book: 'zoo-imperial',
      page: 23,
      label: undefined,
      quote: "cette créature peut se déplacer en VOLANT un tunnel dans la terre",
    });
    expect(r.verdict).toBe('non-attesté');
  });

  it('ATTESTÉ par QUOTE verbatim (cas TABLE, où le label du porteur ne suffit pas)', () => {
    const r = auditSecondaryRef({
      book: 'zoo-imperial',
      page: 23,
      label: undefined,
      quote: "cette créature peut se déplacer en creusant un tunnel dans la terre",
    });
    expect(r.verdict).toBe('attesté');
    expect(r.via).toBe('quote');
  });

  // Tête de chapitre (#1897) : ZI 11 - Chat sauvage.md l.27, avant le premier marqueur (l.47 = 83) ;
  // 10 - Macareux a bec tranchant.md finit sur 82.
  it.each([
    [82, 'attesté'],
    [83, 'non-attesté'],
  ] as const)('tête de chapitre, située par continuité : quote en folio %i → %s', (page, verdict) => {
    const quote = "En présence d'une créature Déstabilisante, une créature Instable compte ses Avantages";
    expect(auditSecondaryRef({ book: 'zoo-imperial', page, label: undefined, quote }).verdict).toBe(verdict);
  });

  it('livre-hors-atlas si le livre déclaré n\'a pas d\'extraction FR', () => {
    const r = auditSecondaryRef({ book: 'inexistant', page: 1, label: 'X', quote: undefined });
    expect(r.verdict).toBe('livre-hors-atlas');
  });
});

/** Nombre d'éléments de TOUT tableau `alsoIn` du document, quelle que soit leur forme — le compte que
 *  l'audit doit avoir VU, mesuré sans passer par son marcheur (`secondaryEntriesOf`). */
function alsoInPoses(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) return node.reduce((n: number, x) => n + alsoInPoses(x), 0);
  return Object.entries(node).reduce(
    (n, [k, v]) => n + (k === 'alsoIn' && Array.isArray(v) ? v.length : 0) + alsoInPoses(v),
    0,
  );
}

describe('auditSecondaries — les entrées `alsoIn` réelles de src/data/*.json', () => {
  it('toutes les entrées `alsoIn` réelles sont ATTESTÉES (aucune violation)', () => {
    const { violations } = auditSecondaries(DIR);
    expect(violations).toEqual([]);
  });

  it('l’audit VOIT chaque `alsoIn` posé : aucun emplacement secondaire ne sort de la mesure en silence', () => {
    const poses = DATASETS.filter((f) => f !== 'books.json')
      .reduce((n, f) => n + alsoInPoses(JSON.parse(readFileSync(join(DIR, f), 'utf8'))), 0);
    const { total } = auditSecondaries(DIR);
    expect(poses, 'aucun `alsoIn` posé : la garde ne mesurerait rien').toBeGreaterThan(0);
    expect(total, `${poses} emplacement(s) posé(s), ${total} audité(s)`).toBe(poses);
  });
});

/**
 * Un `alsoIn` STRICTEMENT égal à son ancre (même `book` ET même `page`) n'atteste rien : l'entrée
 * est déjà à cet emplacement par sa `source`. C'est un no-op documentaire — en pratique un canal
 * détourné pour transporter une donnée du livre faute de champ typé (la donnée appartient à la
 * `desc`, règle stricte 5). Distinct du cas LÉGITIME multi-folios : même livre, page DIFFÉRENTE
 * (une entrée à cheval sur deux pages, ex. `cimeterre` 90→91).
 */
function selfRepublications(data: unknown): string[] {
  const out: string[] = [];
  const walk = (o: unknown): void => {
    if (o == null || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    const rec = o as Record<string, unknown>;
    const src = rec.source as { book?: unknown; page?: unknown } | undefined;
    if (Array.isArray(rec.alsoIn) && src && typeof src.book === 'string' && typeof src.page === 'number') {
      rec.alsoIn.forEach((raw, i) => {
        const s = raw as { book?: unknown; page?: unknown };
        if (s?.book === src.book && s?.page === src.page) out.push(`${String(rec.id ?? rec.label ?? '?')}.alsoIn[${i}] = source (${src.book} p.${src.page})`);
      });
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(data);
  return out;
}

describe('un `alsoIn` ne républie JAMAIS son ancre (livre ET folio identiques)', () => {
  it('EXHAUSTIF : aucun dataset de src/data/*.json ne porte de secondaire égal à sa source', () => {
    const offenders = DATASETS.flatMap((f) => selfRepublications(JSON.parse(readFileSync(join(DIR, f), 'utf8'))).map((k) => `${f}: ${k}`));
    expect(offenders).toEqual([]);
  });

  it('MORSURE — un secondaire forgé sur le folio de l\'ancre est dénoncé', () => {
    expect(
      selfRepublications([
        { id: 'forge', source: { book: 'vents-de-la-magie', page: 167 }, alsoIn: [{ book: 'vents-de-la-magie', page: 167, quote: 'une preuve' }] },
      ]),
    ).toEqual(['forge.alsoIn[0] = source (vents-de-la-magie p.167)']);
  });

  it('LÉGITIME — même livre, folio DIFFÉRENT (entrée à cheval sur deux pages) reste muet', () => {
    expect(
      selfRepublications([{ id: 'cheval', source: { book: 'livre-de-base', page: 90 }, alsoIn: [{ book: 'livre-de-base', page: 91 }] }]),
    ).toEqual([]);
  });
});
