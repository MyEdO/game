import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scanBlindRefs, sitesAveugles, ecartDesRefsAveugles, lireEntreesDeSite, STOCK_PATH, isBlindRef,
  chapterFile, readText, significantWords, SITE_EXEMPTIONS, WINDOW, MIN_WORD_LEN, regenerations,
  type SiteExemption,
} from '../scripts/guards/lib/rawRefIntegrity.mjs';
import { cleDeSite, type Site } from '../scripts/guards/lib/stock.mjs';
import { ecartDeRegeneration, texteEnPlace } from '../scripts/guards/lib/stockDeSites.mjs';

/**
 * Garde « réf RAW AVEUGLE » (#1318) — volet complémentaire de
 * `scripts/raw/check-code-refs.mjs` (qui, lui, ne borne que la ligne : hors borne du chapitre =
 * réf morte). Ici : la réf est DANS les bornes mais la ou les lignes citées sont VIDES, et la
 * fenêtre ±2 du chapitre ne partage AUCUN mot signifiant (≥5 lettres) avec le contexte porteur du
 * code. C'est la forme qu'avait la réf morte du chapitre 17 du LDB, ligne 84 : ligne vide d'un chapitre de 87
 * lignes, adossant une règle absente du livre (mesure : aucune occurrence de « ne transforme »/
 * « Degré de plus » dans tout le LDB) — l'appui RAW était fabriqué, la garde le refuse à
 * l'écriture. NOTE DE GRAPHIE : ce fichier n'écrit AUCUNE réf en graphie canonique `LDB <ch> l.<n>`
 * (elles sont construites par `fixtureRef`, cf. plus bas) — les scanners du dépôt liraient un
 * spécimen de test comme une citation vivante.
 *
 * PORTÉE MESURÉE du recouvrement (à énoncer, pas à supposer) : il est LEXICAL, sur le préfixe de 5
 * lettres — « nourriture » recouvre « nourri », « colère » recouvre « colères », mais un radical
 * distinct, un synonyme ou le terme anglais du code ne recouvrent RIEN. Une dérive de ligne Marker
 * n'est donc innocentée que si son sujet reste à ±2 lignes ET s'écrit pareil : c'est ce qui peuple
 * l'essentiel du stock gelé. Mesures du 2026-08-16 sur le même arbre : 161 sites sans le préfixe
 * (dont 84 avaient pourtant leur sujet à ±6 lignes, rougis sur un pluriel), 108 avec.
 *
 * STOCK : `scripts/guards/raw-blind-refs-stock.json` porterait, par SITE (`fichier :: réf ::
 * occurrence`), les réfs aveugles tolérées — une ENTRÉE par site, jamais un compte, pour qu'un
 * relèvement soit une ligne à déclarer (#1711 T4). Les deux sens échouent : une réf aveugle NEUVE,
 * et une entrée dont le site a disparu (à retirer). Solder une entrée = lire le `Source/` et réancrer
 * la réf sur la ligne qui porte le passage. Le fichier est ABSENT : toute réf aveugle est un ÉCHEC,
 * sans seuil à négocier — le contrat que ce fichier verrouille est « zéro réf aveugle dans `src/` ».
 *
 * ANGLE MORT ASSERTÉ (mesuré, pas supposé) : une réf pointant une ligne PLEINE mais ÉTRANGÈRE au
 * passage est invisible aux DEUX volets — ni `check-code-refs` (elle est dans les bornes du
 * chapitre) ni celui-ci (la ligne n'est pas vide). #1318 en a mesuré 18 dans le seul
 * chapitre 85 du LDB, où la section Taille a glissé d'environ 65 lignes après la ré-extraction
 * Marker : les réfs tombaient en plein texte de « Régénération »/« Résistance à la Magie ». Les
 * détecter exigerait un recouvrement SÉMANTIQUE généralisé (le recouvrement lexical à ±2 lignes ne
 * mord pas ici : la ligne visée est pleine, donc jamais soumise au test).
 * Ce qui les rend TRIABLES sans garde assertive : `node scripts/raw/audit-refs-chapitre.mjs LDB 85`
 * confronte TOUTE réf d'un chapitre au texte de sa ligne, triée par ligne citée — le verdict reste
 * humain (lecture du `Source/`). C'est l'outil qui a levé 13 sites survivants sous #1318, tous
 * verts pour les trois gardes.
 */

/**
 * Réf de FIXTURE, CONSTRUITE et jamais écrite en graphie canonique : ce fichier est scanné par les
 * scanners de réfs du dépôt (`reconcile.mjs` sens A, `check-code-refs.mjs`, `build-implemente`), qui
 * ne distinguent pas une citation d'un spécimen de test — une fixture littérale `LDB <ch> l.<n>` s'y
 * lit comme une vraie citation (vécu : `ch.1 ligne 2` a compté comme trou dur du sens A).
 */
const fixtureRef = (ch: number, line: number): string => ['LDB', String(ch), `l.${line}`].join(' ');
/** Commentaire de fixture porteur d'une réf construite (même raison). */
const fixtureLine = (texte: string, ch: number, line: number): string =>
  `// ${texte} ${fixtureRef(ch, line)}\nexport const zzz = 1;\n`;
describe('garde « réf RAW aveugle » — ligne citée VIDE et sans recouvrement (#1318)', () => {
  const blind = scanBlindRefs();
  const stock = lireEntreesDeSite(STOCK_PATH);
  const { neuves, perimees } = ecartDesRefsAveugles(blind, stock);

  it('aucune réf aveugle NEUVE (ligne vide + zéro recouvrement) hors du stock', () => {
    const detail = neuves.map((o) => {
      const first = blind.find((b) => o.includes(`${b.file} :: ${b.ref}`));
      return first ? `${o}  [${first.file}:${first.row}]` : o;
    });
    expect(
      detail,
      'Réf(s) RAW citant une ligne VIDE dont la fenêtre ±2 ne porte rien du sujet : lire le Source/ et\n' +
        'réancrer sur la ligne qui porte le passage (ou, si le site est irréductible, exemption AU SITE\n' +
        `datée dans SITE_EXEMPTIONS) :\n${detail.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute entrée du stock dont le site a disparu (réf réparée) doit être RETIRÉE', () => {
    expect(perimees, `Stock PÉRIMÉ — retirer de raw-blind-refs-stock.json :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('MORSURE DE BOUT EN BOUT — `scanBlindRefs` sur une arborescence FIXTURE : détecte, innocente, oublie', () => {
    const dir = mkdtempSync(join(tmpdir(), 'raw-ref-integrity-'));
    try {
      // 1. Réf sur une ligne VIDE du chapitre réel, contexte étranger → détectée, nominativement.
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('une regle inventee adossee', 17, 84));
      const vus = scanBlindRefs(dir);
      expect(vus.map((b: { ref: string; row: number }) => `${b.row}:${b.ref}`)).toEqual([`1:${fixtureRef(17, 84)}`]);
      expect(ecartDesRefsAveugles(vus, []).neuves.length).toBe(1);

      // 2. La MÊME ligne citée sur la ligne PLEINE qui porte la règle (l.24) → innocentée.
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('une regle inventee adossee', 17, 24));
      expect(scanBlindRefs(dir)).toEqual([]);

      // 3. Ligne vide MAIS contexte qui reprend le sujet de la fenêtre (dérive Marker) → innocentée.
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('Chance : ajouter un Degre a un Test deja effectue', 17, 26));
      expect(scanBlindRefs(dir)).toEqual([]);

      // 4. Réf retirée → plus rien (le cliquet peut redescendre).
      writeFileSync(join(dir, 'mut.ts'), 'export const zzz = 1;\n');
      expect(scanBlindRefs(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CLIQUET (fixture) : site NEUF et entrée SOLDÉE — les deux sens mordent, l’occurrence distingue les homonymes', () => {
    const ref = fixtureRef(1, 2);
    const site = { file: 'a.ts', row: 1, ref, abbr: 'LDB', nn: '1', lo: 2, hi: 2 };
    const entree = { fichier: 'a.ts', ref, occurrence: 1 };
    expect(ecartDesRefsAveugles([site], []).neuves.length).toBe(1);
    expect(ecartDesRefsAveugles([site, { ...site, row: 9 }], [entree]).neuves.length).toBe(1);
    expect(ecartDesRefsAveugles([], [entree]).perimees.length).toBe(1);
    const aligne = ecartDesRefsAveugles([site], [entree]);
    expect([aligne.neuves, aligne.perimees]).toEqual([[], []]);
  });

  it('RÉGIME CIBLE : l’arbre réel ne porte AUCUNE réf aveugle, et le stock est ABSENT', () => {
    expect(blind.map((b: Site & { row: number }) => `${b.file}:${b.row} — ${b.ref}`)).toEqual([]);
    expect(stock).toEqual([]);
  });

  it('le stock en place est un POINT FIXE de sa régénération', () => {
    for (const r of regenerations(blind)) expect(ecartDeRegeneration(r, texteEnPlace(r.chemin))).toBeNull();
  });

  it('CLIQUET sur une MESURE RÉELLE : un site aveugle scanné sur un chapitre RÉEL est NEUF, l’inscrire l’éteint, le retirer le rend SOLDÉ', () => {
    const dir = mkdtempSync(join(tmpdir(), 'raw-ref-integrity-cliquet-'));
    try {
      writeFileSync(join(dir, 'mut.ts'), fixtureLine('une regle inventee adossee', 17, 84));
      const mesure = scanBlindRefs(dir);
      const [{ file: fichier, ref }] = sitesAveugles(mesure);
      // Le stock confronté est CONSTRUIT ici, jamais dérivé du stock du dépôt : ce test doit mordre à
      // l'identique quand le stock réel se repeuple (une entrée étrangère y serait SOLDÉE).
      // (a) stock VIDE : le site mesuré n'y figure pas → rouge nominatif.
      const cle = cleDeSite({ fichier, ref, occurrence: 1 });
      expect(ecartDesRefsAveugles(mesure, []).neuves.some((o: string) => o.includes(cle))).toBe(true);
      // (b) inscrit à sa mesure → plus rien.
      const inscrit = [{ fichier, ref, occurrence: 1 }];
      const aligne = ecartDesRefsAveugles(mesure, inscrit);
      expect([aligne.neuves, aligne.perimees]).toEqual([[], []]);
      // (c) le site disparaît, l'entrée reste → soldée.
      expect(ecartDesRefsAveugles([], inscrit).perimees.some((s: string) => s.includes(cle))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('MORSURE — le cas historique (ch.17 ligne 84) est ROUGE sur le chapitre RÉEL, la ligne qui porte la règle est VERTE', () => {
    const cf = chapterFile('LDB', '17');
    expect(cf).not.toBeNull();
    const lines = readText(cf!.path).split('\n');
    expect(lines[86].trim()).not.toBe(''); // l.87 = dernière ligne de texte du chapitre
    expect(lines[83].trim()).toBe(''); // ligne 84 = VIDE

    // Contexte porteur historique, tel qu'il vivait dans rollFlowSpecs.ts.
    const contexteHistorique = "DR, `success`/`roll` INTACTS (un Degré de plus ne transforme pas un échec en réussite).";
    expect(isBlindRef(lines, 84, 84, contexteHistorique, WINDOW, MIN_WORD_LEN)).toBe(true);

    // La ligne RÉELLE de l'option de Chance (l.24) porte le texte : jamais rougie.
    expect(lines[23]).toContain('Ajouter +1 DR à un Test après');
    expect(isBlindRef(lines, 24, 24, contexteHistorique, WINDOW, MIN_WORD_LEN)).toBe(false);
  });

  it('PORTÉE du recouvrement : le préfixe de 5 lettres tolère la FORME (pluriel/dérivé), jamais le synonyme', () => {
    const commun = (a: string, b: string) => [...significantWords(b)].some((w: string) => significantWords(a).has(w));
    expect(commun('la nourriture du campement', 'personnage nourri')).toBe(true);   // nourriture / nourri
    expect(commun('accès de colère', 'les colères du Meurtre')).toBe(true);         // colère / colères
    expect(commun('perte d’Avantage', 'les avantages du camp')).toBe(true);         // avantage / avantages
    expect(commun('portée du projectile', 'encombrement du navire')).toBe(false);   // radicaux distincts
    expect(commun('Blessure critique', 'wound modifier stack')).toBe(false);       // vocabulaire de code étranger
    // …mais un cognat FR/EN qui partage le préfixe recouvre (portée réelle, mesurée) :
    expect(commun('Blessure critique', 'critical hit')).toBe(true);                // critique / critical → « criti »
    expect(significantWords('nourriture').has('nourr')).toBe(true);                 // radical = préfixe 5
    expect(significantWords('etat').size).toBe(0);                                  // < 5 lettres : ignoré
  });

  it('MORSURE — dérive Marker : ligne VIDE dont la fenêtre ±2 porte le sujet reste VERTE', () => {
    const cf = chapterFile('LDB', '17');
    const lines = readText(cf!.path).split('\n');
    expect(lines[25].trim()).toBe(''); // ligne 26 = vide (la vraie règle est en l.24, à ±2)
    // Contexte qui NOMME le sujet présent dans la fenêtre (« Ajouter +1 DR à un Test ») :
    expect(isBlindRef(lines, 26, 26, "Chance : ajouter un Degré à un Test déjà effectué", WINDOW, MIN_WORD_LEN)).toBe(false);
    // …et le MÊME emplacement redevient rouge sous un contexte étranger à la fenêtre.
    expect(isBlindRef(lines, 26, 26, "portee des projectiles et encombrement du navire", WINDOW, MIN_WORD_LEN)).toBe(true);
  });

  it('les réfs corrigées dans le lot de pose pointent une ligne PLEINE du chapitre', () => {
    const cas: Array<[string, string, number, string]> = [
      ['LDB', '17', 24, 'Ajouter +1 DR à un Test'],
      ['LDB', '12', 11, 'inférieur ou égal'],
      ['LDB', '12', 40, 'Relance'],
      ['LDB', '10', 767, 'Maniement de deux armes'],
      ['LDB', '16', 7, 'vous perdez immédiatement tout Avantage'],
      ['LDB', '17', 59, 'immunisé à *Psychologie*'],
      ['LDB', '46', 121, 'capable de voir'],
      ['LDB', '16', 13, 'ne se cumulent pas'],
    ];
    const manquants = cas.filter(([abbr, nn, row, needle]) => {
      const cf = chapterFile(abbr, nn);
      if (!cf) return true;
      return !readText(cf.path).split('\n')[row - 1]?.includes(needle);
    }).map(([abbr, nn, row, needle]) => `${abbr} ${nn} l.${row} ne contient pas « ${needle} »`);
    expect(manquants, manquants.join('\n')).toEqual([]);
  });

  it('toute exemption AU SITE porte sa raison ET sa date (jamais une exemption au fichier)', () => {
    const mal = SITE_EXEMPTIONS.filter(
      (e: Partial<SiteExemption>) =>
        !e.file || !e.row || !e.ref || !e.raison || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? ''),
    );
    expect(mal, `Exemption(s) incomplète(s) : ${JSON.stringify(mal)}`).toEqual([]);
  });

  it('le stock ne nomme que des fichiers src/ réellement présents', () => {
    const fantomes = stock.map((e) => e.fichier).filter((f) => {
      try { readFileSync(f, 'utf8'); return false; } catch { return true; }
    });
    expect(fantomes, `Entrée(s) fantôme(s) du stock :\n${fantomes.join('\n')}`).toEqual([]);
  });
});
