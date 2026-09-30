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
import { fileURLToPath } from 'node:url';
import { auditSecondaries, auditSecondaryRef, secondaryEntriesOf } from '../../scripts/guards/lib/folioIntegrity.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
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

  it('livre-hors-atlas si le livre déclaré n\'a pas d\'extraction FR', () => {
    const r = auditSecondaryRef({ book: 'inexistant', page: 1, label: 'X', quote: undefined });
    expect(r.verdict).toBe('livre-hors-atlas');
  });
});

describe('auditSecondaries — 71 entrées `alsoIn` réelles sur src/data/*.json (Lot 2, #563 ; +1 VDM #734 ; +7 Hysh #729 ; +6 Chamon #729 ; +5 attributs de Domaine republiés #729 ; +6 Ghyran #729 ; +7 Azyr #729 ; +5 Ulgu #729 ; +6 Shyish #729 ; +2 Aqshy #729 ; +5 Ghur #729 et son attribut de Domaine ; +2 VDM #731 : Bête des marais et Prédateur sanglant ; +1 VDM couronne-de-flammes ; +1 ZI #1225 : Halagrundsor, récit en folio 34 et statblock en folio 35 ; +1 ADE I #1342 : la spéc `signes-secrets/rodeur`, dont ADE I 07 l.197 imprime la variante « Ranger » ; +1 L2 #1548 : la spéc `signes-secrets/guilde`, dont LDB 09 l.504 imprime la graphie de catalogue « Guildes (au choix) » là où LDB 08 l.250 imprime « Signes secrets (guilde) » ; +3 #1457 : `triton` et `wulfrik`, dont MDG 16 imprime le récit en folio 148/154 et la ligne de stats en folio 149/155, et `ogres`, dont ADE II 02 imprime la prose en folio 15 et le TABLEAU DES ATTRIBUTS DES OGRES en folio 20 ; +8 #1883 : les lignes VÉHICULES et NAVIRES FLUVIAUX (AA 10 l.30-39), publiées en `alsoIn` de leur Véhicule, attestées par leur note narrative en `quote`)', () => {
  it('toutes les entrées `alsoIn` réelles sont ATTESTÉES (aucune violation)', () => {
    const { violations, total } = auditSecondaries(DIR);
    expect(total).toBe(84);
    expect(violations).toEqual([]);
  });

  it('EXHAUSTIF : les fichiers portant `alsoIn` sont exactement les datasets migrés (Lot 2 + talents #734 + creatures #731 + species #1457 + vehicles #1883)', () => {
    const offenders = DATASETS.filter((f) => readFileSync(join(DIR, f), 'utf8').includes('"alsoIn"'));
    expect(offenders).toEqual(['creatures.json', 'domains.json', 'naval-traits.json', 'qualities.json', 'skills.json', 'species.json', 'spells.json', 'talents.json', 'traits.json', 'trappings.json', 'vehicles.json']);
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
