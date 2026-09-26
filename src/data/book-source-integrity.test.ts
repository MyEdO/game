/**
 * Garde d'INTÉGRITÉ de la relation-livre : tout `source.book` porté par une entrée de `src/data/*.json`
 * doit être l'`id` STABLE d'un livre de `books.json` — jamais un libellé ni une abréviation libre.
 * Relation id-pure (i18n-safe) : `books.json` devient la SOURCE DE VÉRITÉ enforced des réfs de livre.
 * Scan file-based de `src/data` (exhaustif, comme `serialize.test.ts`), `src/data` SEUL (pas les worktrees).
 *
 * Volet 2 (#536) — INTÉGRITÉ DU FOLIO : le `book` juste ne prouve pas la `page` juste. La `desc`
 * étant un copié/collé verbatim (règle stricte 5), elle localise l'entrée dans le `Source/` du livre
 * déclaré ; l'encadrement `data-folio` de l'occurrence réfute alors le folio qui ment. Mécanique
 * dans `scripts/guards/lib/folioIntegrity.mjs`, stock gelé dans `folioRatchetStock.mjs`.
 *
 * PÉRIMÈTRE MESURÉ ET ANGLE MORT au 2026-09-06 (#1389 C4) : `src/data/*.json` porte 4516 entrées
 * à `source:{book,page}` ; 1223 citent aussi une ligne et `folio-line-align.test.ts` n'en juge que
 * 321 (902 écartées : 896 hors-forme, 6 queue-trouée), soit 7,1 % des folios vérifiés machine par
 * cette voie. Ces deux chiffres sont seulement écrits ici : `folio-line-align.test.ts` les CLIQUÈTE
 * (`SCANNED_MIN` croissant, `SANS_CITATION_MAX` décroissant).
 * Cette garde-ci scanne les entrées à `desc` citable et en laisse une part hors de tout verdict
 * d'encadrement. Ces populations VIVENT avec le corpus : le PLAFOND (`folioRatchetStock.mjs`) fait
 * foi, pas un chiffre écrit ici, et `node scripts/data/audit-folios.mjs` les re-mesure à la demande.
 * Diagnostic DATÉ du 2026-09-06 : 2723 scannées, 1254 hors verdict (880 descs introuvables, 140 trop
 * courtes, 92 en chapitre sans marqueur, 142 en livre hors Atlas) ; `noteAuthored` empruntée 1 fois
 * (`maladies.json:infection-du-sang` p.186). À re-mesurer avant de le citer — le tronc bouge.
 *
 * Volet 3 (#1389, épique #1388) — PROSE ADRESSÉE : une entrée qui porte `descRef` entre au même
 * dénominateur avec le texte que son adresse RÉSOUT (`citedEntriesOf`). L'invariance est prouvée
 * ci-dessous : inline et adressée rendent le MÊME `desc`, donc le MÊME verdict de folio.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { books } from './index';
import { auditFolio, auditFolios, citedEntriesOf } from '../../scripts/guards/lib/folioIntegrity.mjs';
import { FOLIO_RATCHET } from '../../scripts/guards/lib/folioRatchetStock.mjs';
import { FOLIO_TITLE_RATCHET } from '../../scripts/guards/lib/folioTitleRatchetStock.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const BOOK_IDS = new Set(books.map((b) => b.id));
/** Scan UNIQUE partagé par les deux voies : il relit tout `Source/`. */
const AUDIT = auditFolios(DIR);

function collectBooks(o: unknown, acc: Set<string>): void {
  if (o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) collectBooks(x, acc); return; }
  const rec = o as Record<string, unknown>;
  if (typeof rec.book === 'string') acc.add(rec.book);
  for (const v of Object.values(rec)) collectBooks(v, acc);
}

describe('relation-livre id-pure — tout source.book est un id de books.json', () => {
  const files = listerDossier(DIR).filter((f) => f.endsWith('.json') && f !== 'books.json');
  for (const f of files) {
    it(`${f} : source.book ∈ ids de livres`, () => {
      const found = new Set<string>();
      collectBooks(JSON.parse(readFileSync(join(DIR, f), 'utf8')), found);
      expect([...found].filter((b) => !BOOK_IDS.has(b))).toEqual([]);
    });
  }
  it('books.json : ids uniques et non vides', () => {
    const ids = books.map((b) => b.id);
    expect(ids.every((x) => !!x)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * CŒUR de règles (#1825) : `coeur` désigne le corps de règles dont un livre est le livre de base.
 * Il porte un RÉGIME (`scripts/raw/_lib.mjs#coeurDe` → `reconcile.mjs` : refus de stock en Sens A,
 * calcul du Sens B2) — deux graphies d'un même cœur scinderaient ce régime en deux en silence.
 */
describe('cœur de règles — une graphie par corps de règles (#1825)', () => {
  const coeurs = books.map((b) => b.coeur).filter((c): c is string => c != null);

  it('au moins un livre de cœur est déclaré', () => {
    expect(coeurs.length).toBeGreaterThan(0);
  });

  it('chaque valeur est NORMALISÉE : sans espace de bord, en minuscules, non vide', () => {
    expect(coeurs.filter((c) => c !== c.trim().toLowerCase() || c === '')).toEqual([]);
  });

  it('deux livres ne portent jamais deux graphies d’un même cœur (casse/espaces repliés)', () => {
    const parRepli = new Map<string, Set<string>>();
    for (const c of coeurs) {
      const repli = c.trim().toLowerCase().replace(/\s+/g, '');
      if (!parRepli.has(repli)) parRepli.set(repli, new Set());
      parRepli.get(repli)!.add(c);
    }
    expect([...parRepli].filter(([, g]) => g.size > 1).map(([k, g]) => `${k} : ${[...g].join(' / ')}`)).toEqual([]);
  });
});

/**
 * Plafond du stock cliqueté. Il vit ICI, dans la garde, et NON dans le fichier de stock : sans lui,
 * « le stock ne peut que décroître » n'était qu'un commentaire, et le chemin le plus court pour
 * « solder » une régression restait d'ajouter une ligne au stock, CI verte (précédent `reconcile` :
 * 157 dettes affichées, CI verte). Le relever est un geste délibéré, visible en revue — l'inverse
 * d'un append discret. Il ne DESCEND qu'en soldant des folios au Source.
 */
const FOLIO_RATCHET_MAX = 108;

describe('intégrité du folio — source.page pointe sur la page qui porte la desc (#536)', () => {
  const { violations } = AUDIT;
  const found = new Set(violations.map((v) => v.key));

  it('aucune entrée NEUVE ne déclare un folio réfuté par son Source', () => {
    const nouvelles = violations.filter((v) => !FOLIO_RATCHET.has(v.key));
    expect(
      nouvelles.map((v) => {
        if (v.voie === 'hors-livre') {
          return `${v.key} (${v.book}) déclare p.${v.page}, or le livre s’arrête au folio ${v.max}`;
        }
        const reel = v.ranges
          .map((r) => (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`))
          .join(',');
        return `${v.key} (${v.book}) déclare p.${v.page}, desc trouvée en folio ${reel}`;
      }),
    ).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — aucune clé soldée n’y traîne', () => {
    expect([...FOLIO_RATCHET].filter((k) => !found.has(k))).toEqual([]);
  });

  it('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par la garde', () => {
    expect(FOLIO_RATCHET.size).toBeLessThanOrEqual(FOLIO_RATCHET_MAX);
  });
});

/**
 * Plafond du stock de la VOIE C, même rôle et même lecture que `FOLIO_RATCHET_MAX`. À ZÉRO depuis
 * le solde des 57 clés de la pose (#1225) : toute réfutation par titre est un échec, il
 * n'y a plus de dette à cliqueter.
 */
const FOLIO_TITLE_RATCHET_MAX = 0;

/**
 * Plafond des entrées IRRÉSOLUES — ni desc verbatim, ni titre de section : ce que la garde ne PEUT
 * pas juger. 775 au relevé du 2026-09-23 (#1898), dont `criticals.json` 131, `trappings.json` 109,
 * `mutations.json` 103, `sea-events.json` 55, `careers.json` 49 (la liste complète est rendue par le
 * dernier `it` de ce bloc). C'est la POPULATION auditée qui le fixe : l'audit ne voit qu'une entrée à
 * `desc`, et chaque famille qui y entre apporte ses irrésolues. Il ne descend qu'en recollant des descs
 * au verbatim (règle 5) ou en nommant les entrées comme leur livre les intitule. Plafonné pour la même
 * raison que les stocks : sans plafond, « la garde couvre de plus en plus » n'est qu'un commentaire.
 * Classes identifiées :
 *  - cellule de tableau que l'extraction coupe par des `<br>`, et que la `desc` recolle sans les
 *    reproduire : Critiques des deux jeux (`criticals.json`), stations `pont`, `greement`, `avirons` de
 *    `ship-stations.json` (MDG 13 l.730, l.714, l.751) ;
 *  - phrase coupée par un encadré : `reseau-routier.json:patrouille-routiere` (« LES JUSTICIERS ») ;
 *  - chapitre sans ancre `data-folio` : 3 classes de route de `reseau-routier.json` (`EDOC 06`,
 *    verdict `sans-marqueur`).
 */
// ÉTAT DU MATCHER après #1384 B2 : `normMap` (`scripts/guards/lib/folioIntegrity.mjs:79`) ne compose
// PAS `sansBr`, là où l'adressage (`normText`) le compose. Mesure du 2026-09-23 (#1898), les deux
// branches jouées sur le corpus (`<br>` lu comme une espace, offsets bruts conservés) : la composition
// ferait tomber les irrésolues de 775 à 538 (les 3 stations ci-dessus résolvent) et convertirait 11
// sites en réfutations NEUVES sur ce volet à tolérance zéro — 10 `mass-battle.json` (ADE2, p.88 →
// 90+), 1 `traits.json:destabilisant` (ZI, p.82 → 135) ; `criticals.json` n'en porte aucune (ses
// folios, dans les deux jeux, sont ceux de leur ligne citée, jugés par `folio-line-align.test.ts`).
// C'est la classe « ambiguïté prose/table » de `folioRatchetStock.mjs:31-35` : elle se tranche au PDF,
// site par site, au train B3 de #1384 (relever `FOLIO_RATCHET_MAX` de 108 à 119 serait l'inverse du
// cliquet).
const UNRESOLVED_MAX = 775;

describe('intégrité du folio — voie TITRE de section, et skip BRUYANT de ce qui reste (#1200)', () => {
  const { titleViolations, noteAuthored, unresolved, stats, total } = AUDIT;
  const found = new Set(titleViolations.map((v) => v.key));

  it('aucune entrée NEUVE ne déclare un folio réfuté par le titre de sa section', () => {
    expect(
      titleViolations
        .filter((v) => !FOLIO_TITLE_RATCHET.has(v.key))
        .map(
          (v) =>
            `${v.key} (${v.book}) déclare p.${v.page}, titre le plus proche en folio ${v.proche?.lo ?? '?'} (écart ${v.ecart})`,
        ),
    ).toEqual([]);
  });

  it('le stock des titres ne peut que DÉCROÎTRE — aucune clé soldée n’y traîne', () => {
    expect([...FOLIO_TITLE_RATCHET].filter((k) => !found.has(k))).toEqual([]);
  });

  it('le stock des titres ne GROSSIT pas — sa taille est plafonnée par la garde', () => {
    expect(FOLIO_TITLE_RATCHET.size).toBeLessThanOrEqual(FOLIO_TITLE_RATCHET_MAX);
  });

  it('ce que NI la desc NI le titre ne résolvent est compté et LISTÉ, jamais tu', () => {
    const parFichier = new Map<string, string[]>();
    for (const u of unresolved) {
      const l = parFichier.get(u.file) ?? [];
      l.push(`${u.key.slice(u.file.length + 1)} p.${u.page} (${u.descVerdict}/${u.titreVerdict})`);
      parFichier.set(u.file, l);
    }
    console.log(
      `FOLIO — ${total} entrées citées : ${stats['folio-ok'] ?? 0} prouvées par la desc, ${
        stats['titre:titre-ok'] ?? 0
      } par le titre, ${violationsCount(stats)} réfutées, ${noteAuthored.length} à NOTE AUTHORÉE (jamais cliquetées : ${noteAuthored
        .map((n) => `${n.key} p.${n.page} « ${n.note} »`)
        .join(' ; ')}), ${unresolved.length} IRRÉSOLUES :\n` +
        [...parFichier]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([f, l]) => `  ${f} (${l.length}) : ${l.join(', ')}`)
          .join('\n'),
    );
    expect(unresolved.length).toBeLessThanOrEqual(UNRESOLVED_MAX);
  });
});

/**
 * INVARIANCE de la preuve de folio sous ADRESSAGE (#1389 C4) : `citedEntriesOf` est l'HÔTE UNIQUE de
 * la question « qui entre au dénominateur, et avec quel texte ? ». Une entrée qui migre de `desc`
 * inline vers `descRef` doit y entrer AVEC LE MÊME TEXTE, donc recevoir le MÊME verdict — sans quoi
 * l'adressage déplacerait des entrées hors de l'audit en silence (l'évasion que #536 ferme).
 *
 * Fixture SYNTHÉTIQUE (aucune donnée du dépôt n'est lue ni mutée) : le MÊME passage du `Source/`,
 * une fois recopié et une fois adressé.
 */
const PASSAGE_TERREUR =
  "Certaines créatures sont si profondément perturbantes qu'elles parviennent à provoquer une terreur " +
  'glaçante auprès de leurs adversaires. Lorsque vous rencontrez pour la première fois une créature qui ' +
  'inspire la *Terreur*, effectuez un Test de Psychologie. Sur un succès, vous ne subissez aucun effet ' +
  "supplémentaire à cause de la *Terreur*. Sur un échec, vous gagnez autant d'États *Brisé* que l'*Indice* " +
  'de *Terreur* de la créature, auquel vous rajoutez les DR inférieurs à 0.';

/** L'adresse de ce même passage : LDB 21 § terreur-indice, premier bloc. */
const ADRESSE_TERREUR = {
  book: 'livre-de-base',
  ch: '21',
  parts: [{ kind: 'blocs', sec: 'terreur-indice', secOcc: 1, b0: 0, b1: 0, sum: 'a919b4ef91a1dd3c' }],
};

const SOURCE_TERREUR = { book: 'livre-de-base', page: 191 };

describe('preuve de folio sur la prose ADRESSÉE — même hôte, même verdict (#1389)', () => {
  it('une entrée adressée entre au dénominateur avec le texte que son adresse RÉSOUT', () => {
    const inline = citedEntriesOf([{ id: 'sonde-terreur', label: 'Terreur', desc: PASSAGE_TERREUR, source: SOURCE_TERREUR }]);
    const adressee = citedEntriesOf([{ id: 'sonde-terreur', label: 'Terreur', descRef: ADRESSE_TERREUR, source: SOURCE_TERREUR }]);
    expect(adressee, "l'entrée adressée sort du dénominateur — la preuve de folio ne la voit plus").toHaveLength(1);
    expect(adressee[0].desc).toBe(inline[0].desc);
    expect(auditFolio(adressee[0]).verdict).toBe(auditFolio(inline[0]).verdict);
    expect(auditFolio(adressee[0]).verdict).toBe('folio-ok');
  });

  it('FAIL-CLOSED : une adresse dont l’empreinte diverge LÈVE, elle ne disparaît pas de l’audit', () => {
    const faux = {
      id: 'sonde-terreur',
      descRef: { ...ADRESSE_TERREUR, parts: [{ ...ADRESSE_TERREUR.parts[0], sum: '0'.repeat(16) }] },
      source: SOURCE_TERREUR,
    };
    expect(() => citedEntriesOf([faux])).toThrow(/empreinte-divergente/);
  });
});

/** Somme des verdicts réfutants, pour la ligne de compte du skip bruyant. */
function violationsCount(stats: Record<string, number>): number {
  return (stats['folio-ment'] ?? 0) + (stats['folio-impossible'] ?? 0) + (stats['titre:titre-ment'] ?? 0);
}
