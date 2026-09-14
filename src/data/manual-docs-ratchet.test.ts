/**
 * Cliquet décroissant de la dette de doc MANUSCRITE (#903 — toute la documentation est GÉNÉRÉE
 * depuis le code, jamais écrite à la main). Ce lot ne génère rien : il fige la liste des docs
 * encore manuscrits (`manualDocsStock.mjs`) pour qu'un document manuscrit NEUF échoue la CI.
 *
 * Périmètre — `docs/*.md` À PLAT (hors sous-dossiers, `docs/plans/` et `docs/raw/` compris),
 * même frontière que `scripts/docs/check-doc-refs.mjs` (`listerDossier(DOCS_DIR)` non récursif).
 * Détection GÉNÉRÉ — marqueur `GÉNÉRÉ par` en tête de ligne dans les 10 premières lignes du doc ;
 * les deux formes mesurées dans le dépôt sont couvertes : « ⚠️ Fichier GÉNÉRÉ par … » et
 * « GÉNÉRÉ par `npx tsx …` ».
 *
 * Second volet (#903 suite) — le marqueur ne suffit pas à qualifier un doc de « généré » : rien
 * ne vérifiait que le script cité existe ni qu'il est chaîné dans `docs:check`. C'est exactement
 * le trou par lequel `docs/sorts-implementation.md` a pourri (en-tête GÉNÉRÉ, aucun script `npm`,
 * aucun `--check`, absent de la CI — 160 sorts d'écart mesurés avant correction). Ce fichier
 * verrouille que le marqueur ENGAGE réellement son générateur.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { fileURLToPath } from 'node:url';
import { MANUAL_DOCS_STOCK } from '../../scripts/guards/lib/manualDocsStock.mjs';
import { ecartsDeStock } from '../../scripts/guards/lib/stock.mjs';
// @ts-expect-error - orchestrateur ESM JS (pas de types)
import { NON_GENERATOR_CHECKS, checkedScripts } from '../../scripts/docs/build-all.mjs';
// @ts-expect-error - lib de garde ESM JS (pas de types)
import { commandeEffective } from '../../scripts/guards/lib/justificatif.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DOCS_DIR = join(ROOT, 'docs');
/** Les `.md` À PLAT de `docs/`, en ordre total — UN listage pour les quatre volets qui le lisent. */
const DOCS_MD = listerDossier(DOCS_DIR).filter((f) => f.endsWith('.md'));

const GENERATED_MARKER = /^>\s*(?:⚠️\s*)?(?:Fichier\s+)?GÉNÉRÉ par\b/m;

function isGenerated(text: string): boolean {
  const head = text.split('\n').slice(0, 10).join('\n');
  return GENERATED_MARKER.test(head);
}

function manualDocs(): string[] {
  return DOCS_MD
    .filter((f) => !isGenerated(readFileSync(join(DOCS_DIR, f), 'utf8')))
    .map((f) => `docs/${f}`);
}

/**
 * Le stock est NOMINATIF : `manualDocsStock.mjs` nomme les 8 chemins `docs/*.md` encore manuscrits,
 * et les deux volets ci-dessous le tiennent dans les deux sens — un doc manuscrit NEUF hors du stock
 * rougit à son chemin, une entrée désormais générée (ou disparue) rougit au sien. Un append y coûte
 * donc une ligne VISIBLE : chacune des 8 entrées nomme un fichier, la porte de plage
 * (`croissanceDesStocks`) les voit toutes les 8, et une 9ᵉ se DIT au message par `CLIQUET:`.
 */
describe('cliquet des docs manuscrits — docs/*.md à plat doit se GÉNÉRER, pas s’écrire à la main (#903)', () => {
  const ecarts = ecartsDeStock({
    observe: manualDocs(),
    stock: MANUAL_DOCS_STOCK,
    cle: (d) => d,
    remede: {
      neuve: (d) => `${d} est manuscrit et absent du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock manuel`,
      perimee: (d) => `retirer "${d}" du stock — il est désormais GÉNÉRÉ (ou n'existe plus)`,
    },
  });

  it('aucun doc manuscrit NEUF hors du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock', () => {
    expect(ecarts.neuves).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — aucune entrée désormais GÉNÉRÉE n’y traîne', () => {
    expect(ecarts.perimees).toEqual([]);
  });
});

/**
 * Motif d'extraction du générateur cité en en-tête. Les formes mesurées dans le dépôt divergent
 * (« GÉNÉRÉ par `node scripts/docs/build-systemes.mjs` » vs « GÉNÉRÉ par `npx tsx
 * scripts/gen-sorts-doc.mts` ») : le motif capture tout le contenu entre backticks après
 * « GÉNÉRÉ par », puis retient le PREMIER token qui ressemble à un chemin de script exécutable
 * (`.mjs`/`.mts`/`.cjs`/`.ts`/`.js`) — insensible au lanceur (`node`, `npx tsx`…) qui le précède.
 */
const GENERATOR_QUOTE = /GÉNÉRÉ par\s+`([^`]+)`/;

function extractGeneratorScript(head: string): string | null {
  const m = head.match(GENERATOR_QUOTE);
  if (!m) return null;
  const token = m[1].split(/\s+/).find((t) => /\.(?:mjs|mts|cjs|ts|js)$/.test(t));
  return token ?? null;
}

function generatedDocs(): { file: string; head: string }[] {
  return DOCS_MD
    .map((f) => ({ file: f, text: readFileSync(join(DOCS_DIR, f), 'utf8') }))
    .filter(({ text }) => isGenerated(text))
    .map(({ file, text }) => ({ file, head: text.split('\n').slice(0, 10).join('\n') }));
}

describe('le marqueur GÉNÉRÉ engage réellement son générateur (#903 suite)', () => {
  const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  // L'enveloppe de justificatif de gate (#1679 L2) n'est pas la porte : ce qui est jugé ici, c'est la
  // chaîne RÉELLEMENT jouée, résolue par `commandeEffective` (source unique du dépaquetage).
  const DOCS_CHECK_SCRIPT = commandeEffective(PACKAGE_JSON.scripts, 'docs:check');
  // Source UNIQUE des générateurs vérifiés : `docs:check` ne les nomme plus un à un, il délègue à
  // `build-all.mjs --check`. Parser la chaîne npm ne mesurerait plus rien.
  const CHECKED: Set<string> = checkedScripts();

  it('tout doc `GÉNÉRÉ par` cite un script qui existe et qui est chaîné en --check dans docs:check', () => {
    const violations = generatedDocs().flatMap(({ file, head }) => {
      const script = extractGeneratorScript(head);
      if (!script) {
        return [
          `docs/${file} se déclare GÉNÉRÉ sans citer de script exécutable en en-tête — un marqueur sans générateur pourrit en silence (précédent : docs/sorts-implementation.md, 160 sorts d'écart avant correction)`,
        ];
      }
      const violationsForDoc: string[] = [];
      if (!existsSync(join(ROOT, script))) {
        violationsForDoc.push(
          `docs/${file} se déclare GÉNÉRÉ par "${script}" — ce script n'existe pas sur disque : le marqueur pourrit en silence`,
        );
      }
      if (!CHECKED.has(script)) {
        violationsForDoc.push(
          `docs/${file} se déclare GÉNÉRÉ par "${script}" — absent (ou sans mode --check) de GENERATORS dans scripts/docs/build-all.mjs, la source unique que docs:check exécute : le marqueur pourrit en silence, non gardé par la CI`,
        );
      }
      return violationsForDoc;
    });
    expect(violations).toEqual([]);
  });

  it('docs:check exécute BIEN la source unique et ses vérificateurs purs', () => {
    expect(DOCS_CHECK_SCRIPT).toContain('scripts/docs/build-all.mjs --check');
    const manquants = (NON_GENERATOR_CHECKS as string[]).filter((s) => !DOCS_CHECK_SCRIPT.includes(s));
    expect(manquants.map((s) => `${s} n'est plus chaîné par docs:check`)).toEqual([]);
  });
});

/**
 * Troisième volet (#908) — le marqueur `GÉNÉRÉ` engage son générateur (#903 suite), mais un
 * générateur qui ne déclare pas son PÉRIMÈTRE MESURÉ se lit comme exhaustif alors qu'aucune mesure
 * ne l'est. La section s'émet DEPUIS le générateur (jamais à la main dans le `.md`, sinon elle
 * périme comme le reste) — patron : `docs/vocabulaire-mecanique.md:33-36`.
 */
// Deux phrases co-présentes, PAS un mot isolé (piège de mesure consigné dans #908 : « périmètre »
// seul donne des faux positifs — `systemes.md` « nom/périmètre/état/ticket », une ligne de tableau
// de `sorts-implementation.md`). La forme du rendu diverge selon le générateur (bloc `**gras**` sur
// une ligne, titre `## Périmètre mesuré et angles morts`, ou blockquote `> ` multi-lignes) — le texte
// est donc normalisé (continuations de blockquote et retours à la ligne aplatis) avant le test.
function hasPerimeterSection(text: string): boolean {
  const normalized = text.replace(/\n>?\s*/g, ' ');
  return /P[ée]rim[èe]tre\s+mesur[ée]s?/i.test(normalized) && /angles?\s+morts?/i.test(normalized);
}

function fullGeneratedDocs(): { file: string; text: string }[] {
  return DOCS_MD
    .map((f) => ({ file: f, text: readFileSync(join(DOCS_DIR, f), 'utf8') }))
    .filter(({ text }) => isGenerated(text));
}

describe('tout doc `GÉNÉRÉ` déclare son périmètre mesuré et ses angles morts (#908)', () => {
  it('section « Périmètre mesuré / angles morts » présente dans chaque doc GÉNÉRÉ', () => {
    const violations = fullGeneratedDocs()
      .filter(({ text }) => !hasPerimeterSection(text))
      .map(
        ({ file }) =>
          `docs/${file} se déclare GÉNÉRÉ sans section « Périmètre mesuré / angles morts » — un généré qui ne dit pas ce qu'il ne couvre PAS se lit comme exhaustif ; la section s'émet depuis le générateur (patron : docs/vocabulaire-mecanique.md:33-36)`,
      );
    expect(violations).toEqual([]);
  });
});

/**
 * Garde symétrique du cliquet manuscrit ci-dessus — SANS stock. La table de routage de
 * `CLAUDE.md` (§ « Table de routage — lire le bon doc AU MOMENT du déclencheur ») est la SEULE
 * surface injectée chez tout agent de ce dépôt : un doc qu'elle ne mentionne pas — ni
 * directement, ni via un document lui-même routé — est invisible, quelle que soit sa qualité.
 * Cette garde n'a PAS de stock cliqueté : tout doc non routé la fait échouer, sans marge — une
 * liste d'exceptions « qui décroît » se maintient à jamais et se contourne
 * (`.claude/memory/game-garde-exemption-au-site-jamais-au-fichier.md`).
 *
 * « Routé » = atteint depuis la table par une clôture transitive de citations `docs/<fichier>.md`
 * (motif explicite, chemin depuis la racine du dépôt) : la table cite directement des docs, et
 * tout doc ainsi routé qui cite à son tour un `docs/<fichier>.md` route ce doc-là aussi. Angle
 * mort déclaré : un lien markdown relatif SANS le préfixe `docs/` (`[x](donnees.md)` depuis un
 * autre fichier de `docs/`) échapperait à ce motif — mesuré absent aujourd'hui pour les docs à
 * plat (seuls `docs/raw/` et `docs/plans/` en usent, entre fichiers de leur propre sous-dossier,
 * hors du périmètre à plat de ce fichier).
 */
const CLAUDE_MD_PATH = join(ROOT, 'CLAUDE.md');
const DOC_CITATION = /docs\/[a-zA-Z0-9_.-]+\.md/g;

function routingTableSlice(claudeMd: string): string {
  const start = claudeMd.indexOf('## Table de routage');
  if (start === -1) {
    throw new Error('CLAUDE.md ne porte plus de section "## Table de routage" — garde à réancrer');
  }
  const afterStart = claudeMd.slice(start + 1);
  const nextHeading = afterStart.indexOf('\n## ');
  const end = nextHeading === -1 ? claudeMd.length : start + 1 + nextHeading;
  return claudeMd.slice(start, end);
}

function routedFlatDocs(): Set<string> {
  const claudeMd = readFileSync(CLAUDE_MD_PATH, 'utf8');
  const routed = new Set<string>();
  const queue: string[] = [];
  for (const m of routingTableSlice(claudeMd).matchAll(DOC_CITATION)) {
    if (!routed.has(m[0])) {
      routed.add(m[0]);
      queue.push(m[0]);
    }
  }
  while (queue.length > 0) {
    const doc = queue.shift() as string;
    const docPath = join(ROOT, doc);
    if (!existsSync(docPath)) continue;
    const text = readFileSync(docPath, 'utf8');
    for (const m of text.matchAll(DOC_CITATION)) {
      if (!routed.has(m[0])) {
        routed.add(m[0]);
        queue.push(m[0]);
      }
    }
  }
  return routed;
}

function flatDocPaths(): string[] {
  return DOCS_MD.map((f) => `docs/${f}`);
}

describe('docs/*.md à plat doit être atteignable depuis la table de routage de CLAUDE.md — pas de stock, un doc neuf se ROUTE', () => {
  it('aucun doc à plat non atteignable depuis la table (directement ou via un doc lui-même routé)', () => {
    const routed = routedFlatDocs();
    const unrouted = flatDocPaths().filter((d) => !routed.has(d));
    expect(
      unrouted.map(
        (d) =>
          `${d} n'est atteignable depuis aucun déclencheur de la table de routage de CLAUDE.md (ni directement, ni via un doc lui-même routé) — ajouter une ligne à la table (question qu'un agent se pose, sur le modèle des lignes existantes), ou citer ce doc depuis un doc déjà routé`,
      ),
    ).toEqual([]);
  });
});
