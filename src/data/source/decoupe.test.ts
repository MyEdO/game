// Tests de la bibliothèque de DÉCOUPE (`decoupe.ts`) : recollage des paragraphes coupés par un
// saut de folio, folio COURANT, occurrences de titres dupliqués, adresse de CELLULE de table,
// contrôle d'empreinte, montage d'adresse et chargement SOUS NODE NU. Ces tests lisent le VRAI
// `Source/` — les cas de recette sont cités par `fichier:ligne`. UNE exception, nommée à son site :
// le prédicat de couverture d'une CELLULE se verrouille sur une fixture (deux tables SANS titre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REGISTRE_LIVRES, chapterFile, estLivreExtrait, sigleDe } from '../../../scripts/guards/lib/rawRefIntegrity.mjs';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import {
  type ChapitreParse, type Fragment, type FragmentBlocs, type FragmentCellule, type Resolu,
  type Section, type TableParse,
  blocsCouverts, blocsPlats, cellRefFor, empreinteDe, estErreur, estGraphieDeChapitre,
  estNomDExtraction, estNumeroDeChapitre, fichierDuChapitre, findCells, graphieDeChapitre,
  graphieDuFichier, largeurDeChapitre, normText, numeroDuFichier, parseChapitre, parseTable,
  prefixesDeChapitres, resoudreAdresse, resoudreFragment, stripSpans, sumOf, tablesOf, titreDuFichier,
} from './decoupe.ts';
import { foliosRoulants } from './ancre-vide.ts';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const LDB = 'livre-de-base';
const EDO = 'ennemi-dans-l-ombre';

const _cache = new Map<string, ChapitreParse>();

/** Chemin du fichier de chapitre `NN` d'un livre. */
function cheminChapitre(bookId: string, ch: string): string {
  const abbr = sigleDe(bookId);
  const f = abbr ? chapterFile(abbr, ch) : null;
  if (!f) throw new Error(`chapitre introuvable : ${bookId} ch.${ch}`);
  return join(RACINE, f.path);
}

/** Chaque chapitre de chaque livre extrait : `{ bookId, graphie }`. */
function chapitresDuCorpus(): { bookId: string; graphie: string }[] {
  return REGISTRE_LIVRES.filter(estLivreExtrait).flatMap((livre) => listerDossier(join(RACINE, livre.dir!))
    .map((f) => graphieDuFichier(f))
    .filter((g): g is string => g != null)
    .map((graphie) => ({ bookId: livre.id, graphie })));
}

/** Chapitre `NN` d'un livre, lu au disque (CRLF-robuste) et parsé, avec cache. */
function chapitreDe(bookId: string, ch: string): ChapitreParse {
  const cle = `${bookId}|${ch}`;
  const memo = _cache.get(cle);
  if (memo) return memo;
  const parse = parseChapitre(readFileSync(cheminChapitre(bookId, ch), 'utf8').replace(/\r\n|\r/g, '\n'));
  _cache.set(cle, parse);
  return parse;
}

const sectionOf = (ch: string, slug: string, occ = 1) =>
  chapitreDe(LDB, ch).sections.find((s) => s.slug === slug && s.occ === occ)!;

/** Fragment estampillé de son empreinte RÉELLE (ce que fait un producteur d'adresse). */
function estampille<T extends Fragment>(chapitre: ChapitreParse, frag: Omit<T, 'sum'>): T {
  const brouillon = { ...frag, sum: '' } as T;
  const sum = empreinteDe(chapitre, brouillon);
  return { ...brouillon, sum: typeof sum === 'string' ? sum : '' };
}

/** Résout un fragment de blocs du LDB, empreinte posée à la volée. */
function blocs(ch: string, sec: string, b0: number, b1: number, opts: { secOcc?: number; sum?: string } = {}) {
  const chapitre = chapitreDe(LDB, ch);
  const frag = estampille<FragmentBlocs>(chapitre, { kind: 'blocs', sec, secOcc: opts.secOcc ?? 1, b0, b1 });
  return resoudreFragment(chapitre, opts.sum === undefined ? frag : { ...frag, sum: opts.sum });
}

/** `19 - Corruption.md:118` : `| 01–05 | Pattes d'animaux | +1 Mouvement | | |` */
const CELL = { kind: 'cellule' as const, sec: 'tableau-de-corruption-physique', secOcc: 1, row: "Pattes d'animaux", col: 'Effet' };

/** Résout un fragment de cellule du ch.19, empreinte posée à la volée. */
function cellule(over: Partial<Omit<FragmentCellule, 'kind'>> = {}, sum?: string) {
  const chapitre = chapitreDe(LDB, '19');
  const frag = estampille<FragmentCellule>(chapitre, { ...CELL, ...over });
  return resoudreFragment(chapitre, sum === undefined ? frag : { ...frag, sum });
}

describe('parseChapitre — blocs, folios, sections', () => {
  // Le module est PUR : son texte vient d'un lecteur fs, d'un `fetch` d'asset ou d'une fixture, et
  // tous ne rendent pas du LF. La découpe ne peut donc pas dépendre des fins de ligne : mêmes
  // sections, mêmes blocs, mêmes folios, mêmes empreintes.
  it('LF et CRLF rendent la MÊME découpe (sections, blocs, folios, empreintes)', () => {
    const lf = readFileSync(cheminChapitre(LDB, '21'), 'utf8').replace(/\r\n|\r/g, '\n');
    const enLf = parseChapitre(lf);
    const enCrlf = parseChapitre(lf.replace(/\n/g, '\r\n'));
    expect(enLf.sections.length, 'la fixture doit porter plusieurs sections').toBeGreaterThan(5);
    const image = (c: ChapitreParse) => c.sections.map((s) => ({
      slug: s.slug, occ: s.occ, title: s.title, level: s.level, folio: s.folio,
      blocks: s.blocks.map((b) => ({ md: b.md, line: b.line, folio: b.folio, folios: b.folios, sum: sumOf(b.md) })),
    }));
    expect(image(enCrlf)).toEqual(image(enLf));
  });

  // `21 - Psychologie.md:45-48` : le folio coupe la phrase mi-mot (« … comme les » / « « ostlanders » … »).
  it('recollage : Préjugé (Cible) rend un paragraphe d\'un seul tenant', () => {
    const sec = sectionOf('21', 'prejuge-cible');
    expect(sec.blocks.length).toBe(2);
    expect(sec.blocks[0].md).toMatch(/comme les « ostlanders », les « elfes »/);
    // `21 - Psychologie.md:45` : premier morceau du bloc recollé.
    expect(sec.blocks[0].line).toBe(45);
  });

  // `01 - Chapitre 1 - On recherche - aventuriers courageux.md:185-186` : le segment s'ouvre sur une
  // ligne réduite à un marqueur de folio, le texte commence à la suivante.
  it('line : un segment ouvert par un marqueur de folio seul pointe la ligne du texte', () => {
    const bloc = chapitreDe(EDO, '01').sections.flatMap((s) => s.blocks)
      .find((b) => b.md.includes("tranquille. Celle-ci s'exécutera docilement"));
    expect(bloc?.line).toBe(186);
  });

  // `line` est la ligne du fichier où commence `md`, sur tout le corpus extrait.
  it('line : chaque bloc de chaque chapitre extrait pointe la ligne où commence son texte, en ordre croissant', () => {
    const ecarts: string[] = [];
    let blocsVus = 0;
    for (const { bookId, graphie } of chapitresDuCorpus()) {
      const lignes = readFileSync(cheminChapitre(bookId, graphie), 'utf8').replace(/\r\n|\r/g, '\n').split('\n');
      const texte = (n: number) => stripSpans(lignes[n - 1] ?? '').trim();
      let avant = 0;
      for (const s of chapitreDe(bookId, graphie).sections) {
        for (const b of s.blocks) {
          blocsVus++;
          const ou = `${bookId} ch.${graphie}:${b.line}`;
          const ouverture = texte(b.line);
          if (!ouverture || !b.md.split('\n')[0].startsWith(ouverture)) ecarts.push(`${ou} : n'ouvre pas le texte`);
          const heading = s.level > 0 && b.line - 1 === s.line;
          if (b.line > 1 && !heading && texte(b.line - 1)) ecarts.push(`${ou} : la ligne précédente porte du texte`);
          if (b.line <= avant) ecarts.push(`${ou} : non croissant (précédent ${avant})`);
          avant = b.line;
        }
      }
    }
    expect(blocsVus, 'le corpus doit porter des blocs').toBeGreaterThan(30000);
    expect(ecarts.slice(0, 20), `${ecarts.length} écart(s)`).toEqual([]);
  });

  // `05 - _gjdgxs.md:438-441` : le bloc précédent finit par `…protéger une autre.*` (ponctuation
  // masquée sous l'emphase) et le suivant OUVRE sur `**Exemple :**` — deux paragraphes logiques.
  it('D1 : pas de recollage quand la ponctuation finale est sous l\'emphase et que le suivant ouvre sur `**`', () => {
    const sec = sectionOf('05', 'choisir-la-motivation');
    const clotilda = sec.blocks.findIndex((b) => b.md.includes('Clotilda'));
    expect(clotilda).toBeGreaterThanOrEqual(0);
    expect(sec.blocks[clotilda].md.endsWith('protéger une autre.*')).toBe(true);
    expect(sec.blocks[clotilda].md.includes('Ebba')).toBe(false);
    expect(sec.blocks[clotilda + 1].md.startsWith('**Exemple :** *Ebba')).toBe(true);
  });

  // `09 - Competences.md:26-30` : discrimine la SEULE règle de ponctuation sous habillage — le bloc
  // suivant est de la prose nue, seul un `…l'Agilité.*` vu comme terminé empêche la soudure.
  it('D1 : ponctuation terminale sous emphase — coupe même quand le suivant est de la prose nue', () => {
    const sec = sectionOf('09', 'competences-de-base-et-avancees');
    const sigrid = sec.blocks.findIndex((b) => b.md.includes('Sigrid'));
    expect(sec.blocks[sigrid].md.endsWith("l'Agilité.*")).toBe(true);
    expect(sec.blocks[sigrid + 1].md.startsWith('Les Compétences Avancées')).toBe(true);
  });

  // `08 - Statut.md:262-265` : discrimine la SEULE règle d'ouverture — le bloc précédent
  // (« **Possessions :** … vêtement de qualité ») ne finit sur AUCUNE ponctuation.
  it('D1 : un bloc suivant ouvert par une emphase reste un paragraphe distinct', () => {
    const sec = sectionOf('08', 'maitre-de-guilde-or-1');
    const poss = sec.blocks.findIndex((b) => b.md.startsWith('**Possessions :**'));
    expect(poss).toBeGreaterThanOrEqual(0);
    expect(/[.!?»”:;]$/.test(sec.blocks[poss].md)).toBe(false);
    expect(sec.blocks[poss + 1].md.startsWith('*Ambitieux et socialement mobile')).toBe(true);
  });

  // `19 - Corruption.md:140` : le marqueur `data-folio="185"` ouvre la section, aucun span n'est
  // INTERNE aux blocs de la table qui suit — sans folio courant, l'adresse rendrait `folios: []`.
  it('B : folio courant — une adresse sans span interne rend tout de même son folio', () => {
    const sec = sectionOf('19', 'tableau-de-corruption-mentale');
    const last = sec.blocks.length - 1;
    expect(sec.blocks[last].folios).toEqual([]);
    const res = blocs('19', 'tableau-de-corruption-mentale', last, last);
    expect((res as Resolu).folios).toEqual([185]);
  });

  it('B : le folio courant roule d\'une section à l\'autre du chapitre', () => {
    const terreur = sectionOf('21', 'terreur-indice');
    expect(terreur.folio).toBe(191);
    expect((blocs('21', 'terreur-indice', 0, 0) as Resolu).folios).toEqual([191]);
  });

  // `08 - Statut.md` répète « Évolution de Carrière » ×31 : `secOcc` est la seule chose qui distingue.
  it('titres dupliqués : occ=2 résout une section différente d\'occ=1', () => {
    const s1 = sectionOf('08', 'evolution-de-carriere', 1);
    const s2 = sectionOf('08', 'evolution-de-carriere', 2);
    expect(s1.line).not.toBe(s2.line);
    const r1 = blocs('08', 'evolution-de-carriere', 0, 0, { secOcc: 1 }) as Resolu;
    const r2 = blocs('08', 'evolution-de-carriere', 0, 0, { secOcc: 2 }) as Resolu;
    expect(r1.md).not.toBe(r2.md);
  });
});

describe('ancre de page VIDE (`ancreVide`) — ni folio roulant, ni `folios` (CRB)', () => {
  it('`foliosRoulants` : une ancre vaut pour la ligne dont elle précède le texte, posée après du texte pour la suivante ; vide, pour aucune', () => {
    const A = (n: number) => `<span id="page-${n - 1}-0" data-folio="${n}"></span>`;
    expect(foliosRoulants(['avant', `${A(10)}Texte`, `suite ${A(11)}fin`, 'après', `${A(12)}`, 'douze', `  ${A(13)}${A(14)}Page 14`, `# ${A(15)}Titre`, 'quinze', `${A(16)}`, `${A(17)}dix-sept`, `x ${A(18)}`])).toEqual([null, 10, 10, 11, 12, 12, 14, 14, 15, 15, 17, 17]);
  });
  it('folio de SECTION : celui qui court au bout de la ligne du titre — ancre en tête de la ligne SUIVANTE exclue, ancre de la ligne du titre comprise', () => {
    const A = (n: number) => `<span id="page-${n - 1}-0" data-folio="${n}"></span>`;
    const { sections } = parseChapitre([`${A(1)}Avant`, '', '# **Titre**', `${A(2)}Suite`, '', `## ${A(3)}**Trois**`, '', 'Corps'].join('\n'));
    expect(sections.map((s) => [s.title, s.folio, s.blocks.map((b) => b.folio)])).toEqual([['', null, [1]], ['Titre', 1, [2]], ['Trois', 3, [3]]]);
  });
  it('`foliosRoulants` sur le CRB réel : 004 l.75 → 10 ; titre `# <ancres 12-14>` l.109 → 11, l.110 → 14 ; ancre vide en fin de ligne : 032 l.137 → 159, 122 l.89 → 377', () => {
    const lignes = (ch: string) => readFileSync(cheminChapitre('core-rulebook-5e', ch), 'utf8').replace(/\r\n|\r/g, '\n').split('\n');
    const l004 = foliosRoulants(lignes('004'));
    expect([l004[74], l004[108], l004[109], foliosRoulants(lignes('032'))[136], foliosRoulants(lignes('122'))[88]]).toEqual([10, 11, 14, 159, 377]);
  });
  const blocDe = (ch: string, trouve: (md: string) => boolean) =>
    chapitreDe('core-rulebook-5e', ch).sections.flatMap((s) => s.blocks).find((b) => trouve(b.md))!;
  it('004 l.75 : ancres vides 8 et 9 enchaînées devant l’ancre à texte 10 → folio 10, folios [10]', () => {
    const b = blocDe('004', (md) => md.startsWith('Being the thoughts'));
    expect([b.line, b.folio, b.folios]).toEqual([75, 10, [10]]);
  });
  it('032 : ancre vide 160 en fin de la dernière ligne du fichier → folios []', () => {
    expect(blocDe('032', (md) => md.includes('OBSTACLE TABLE')).folios).toEqual([]);
  });
  it('122 : ancre vide 378 en fin de fichier → folios [377]', () => {
    expect(blocDe('122', (md) => md.includes('WEALTH')).folios).toEqual([377]);
  });
});

describe('resoudreFragment — cellules, empreinte, bornes', () => {
  it('C : adresse de cellule — clé de ligne × en-tête de colonne', () => {
    const res = cellule() as Resolu;
    expect(res.md).toBe('+1 Mouvement');
    expect(res.folios).toEqual([184]);
  });

  it('C : la clé de ligne se cherche dans TOUTES les colonnes', () => {
    expect((cellule({ row: '01–05', col: 'Description' }) as Resolu).md).toBe("Pattes d'animaux");
  });

  it('C : erreurs structurées — ligne introuvable, colonne inconnue', () => {
    expect((cellule({ row: 'Pattes de chaise' }) as { error: string }).error).toBe('ligne-introuvable');
    expect((cellule({ col: 'Conséquence' }) as { error: string }).error).toBe('colonne-inconnue');
  });

  it('C : `findCells` retrouve la cellule dans le chapitre, une seule fois', () => {
    const hits = findCells(chapitreDe(LDB, '19'), normText('+1 Mouvement'));
    expect(hits.length).toBe(1);
    expect(hits[0].sec).toBe('tableau-de-corruption-physique');
  });

  it('D : empreinte — une adresse juste passe, une adresse falsifiée est refusée', () => {
    const ok = blocs('21', 'prejuge-cible', 0, 1);
    expect(estErreur(ok)).toBe(false);
    const ko = blocs('21', 'prejuge-cible', 0, 1, { sum: '0000000000000000' });
    expect((ko as { error: string }).error).toBe('empreinte-divergente');
    expect((ko as { detail: string }).detail).toMatch(/texte résolu=/);
  });

  it('D : l\'empreinte est vérifiée aussi sur une adresse de cellule', () => {
    expect(estErreur(cellule())).toBe(false);
    expect((cellule({}, 'deadbeefcafe0000') as { error: string }).error).toBe('empreinte-divergente');
  });

  it('bornes hors limites et section inconnue', () => {
    const sec = sectionOf('21', 'prejuge-cible');
    const err = (r: unknown) => (r as { error: string }).error;
    expect(err(blocs('21', 'prejuge-cible', 0, sec.blocks.length))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'prejuge-cible', -1, 0))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'prejuge-cible', 1, 0))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'prejuge-cible', 0, 1.5))).toBe('bornes-hors-limites');
    expect(err(blocs('21', 'section-qui-nexiste-pas', 0, 0))).toBe('section-inconnue');
  });
});

describe('blocsPlats — mémo par identité', () => {
  it('le mémo de blocs plats tient par IDENTITÉ de chapitre', () => {
    const chapitre = chapitreDe(LDB, '21');
    expect(blocsPlats(chapitre)).toBe(blocsPlats(chapitre));
    const jumeau = parseChapitre(readFileSync(cheminChapitre(LDB, '21'), 'utf8').replace(/\r\n|\r/g, '\n'));
    expect(blocsPlats(jumeau)).not.toBe(blocsPlats(chapitre));
    expect(blocsPlats(jumeau)).toEqual(blocsPlats(chapitre));
  });
});

describe('numéro de chapitre — un ENTIER, une graphie à la largeur de son LIVRE', () => {
  it('la largeur est celle du plus grand numéro du livre, DEUX au minimum', () => {
    expect(largeurDeChapitre(1)).toBe(2);
    expect(largeurDeChapitre(85)).toBe(2);
    expect(largeurDeChapitre(99)).toBe(2);
    expect(largeurDeChapitre(100)).toBe(3);
    expect(largeurDeChapitre(120)).toBe(3);
    expect(largeurDeChapitre(1000)).toBe(4);
  });

  it('la graphie zéro-padde à la largeur reçue, et n’ampute jamais un numéro plus large', () => {
    expect(graphieDeChapitre(7, largeurDeChapitre(85))).toBe('07');
    expect(graphieDeChapitre(21, largeurDeChapitre(85))).toBe('21');
    expect(graphieDeChapitre(7, largeurDeChapitre(120))).toBe('007');
    expect(graphieDeChapitre(99, largeurDeChapitre(120))).toBe('099');
    expect(graphieDeChapitre(105, largeurDeChapitre(120))).toBe('105');
    expect(graphieDeChapitre(105, 2)).toBe('105');
  });

  it('refuse ce qui n’est pas un numéro de chapitre : zéro, négatif, non entier', () => {
    for (const n of [0, -1, 1.5, Number.NaN]) {
      expect(estNumeroDeChapitre(n), `estNumeroDeChapitre(${n})`).toBe(false);
      expect(() => largeurDeChapitre(n), `largeurDeChapitre(${n})`).toThrow(/entier ≥ 1/);
      expect(() => graphieDeChapitre(n, 2), `graphieDeChapitre(${n})`).toThrow(/entier ≥ 1/);
    }
    expect(estNumeroDeChapitre(1)).toBe(true);
    expect(estNumeroDeChapitre('1')).toBe(false);
  });

  it('l’INDEX n’est pas un chapitre : `00 - Index.md` ne porte aucun numéro, et `00` ne résout rien', () => {
    expect(numeroDuFichier('00 - Index.md')).toBeNull();
    expect(graphieDuFichier('00 - Index.md')).toBeNull();
    // Un `00 - Autre.md` non plus : c'est le NUMÉRO qui tranche, jamais le nom de l'index.
    expect(numeroDuFichier('00 - Prologue.md')).toBeNull();
    expect(numeroDuFichier('07 - Peur.md')).toBe(7);
    expect(graphieDuFichier('007 - Peur.md')).toBe('007');
    expect(titreDuFichier('00 - Index.md')).toBe('Index');
    // Le motif d'EXTRACTION, lui, couvre l'index : c'est la question des gardes de FORME.
    expect(estNomDExtraction('00 - Index.md')).toBe(true);
    expect(estNomDExtraction('Index.md')).toBe(false);

    const listing = ['00 - Index.md', '07 - Peur.md', '105 - Suite.md'];
    expect(prefixesDeChapitres(listing)).toEqual(['07', '105']);
    for (const nul of [0, '00', '', null, undefined, 'x']) {
      expect(fichierDuChapitre(listing, nul), `fichierDuChapitre(…, ${JSON.stringify(nul)})`).toBeNull();
    }
    expect(fichierDuChapitre(listing, '007')).toBe('07 - Peur.md');
  });

  it('la GRAPHIE d’un `ch` d’adresse : deux chiffres au moins, et un numéro de CHAPITRE', () => {
    for (const bon of ['07', '21', '105', '0105']) expect(estGraphieDeChapitre(bon), bon).toBe(true);
    for (const mauvais of ['00', '000', '7', '', 'ch7', '2a', '-1']) {
      expect(estGraphieDeChapitre(mauvais), mauvais).toBe(false);
    }
  });
});

describe('sumOf — empreinte 64 bits', () => {
  it('rend 16 hex dont les deux moitiés DIFFÈRENT (deux sels distincts)', () => {
    const sec = sectionOf('21', 'peur-indice');
    for (const b of sec.blocks) {
      const s = sumOf(b.md);
      expect(s).toMatch(/^[0-9a-f]{16}$/);
      expect(s.slice(0, 8)).not.toBe(s.slice(8));
    }
  });

  it('aucune COLLISION sur les blocs des 16 livres extraits', () => {
    const parSum = new Map<string, string>();
    let blocsVus = 0;
    let collisions = 0;
    for (const { bookId, graphie } of chapitresDuCorpus()) {
      for (const b of blocsPlats(chapitreDe(bookId, graphie))) {
        if (!b.norm) continue;
        blocsVus++;
        const vu = parSum.get(sumOf(b.md));
        if (vu === undefined) parSum.set(sumOf(b.md), b.norm);
        else if (vu !== b.norm) collisions++;
      }
    }
    console.log(`empreintes : ${blocsVus} blocs, ${parSum.size} empreintes, ${collisions} collisions`);
    expect(blocsVus).toBeGreaterThan(20_000);
    expect(collisions).toBe(0);
  });
});

describe('resoudreAdresse — montage de fragments', () => {
  const chapitre21 = () => chapitreDe(LDB, '21');
  const fragment21 = (sec: string, b0: number, b1: number) =>
    estampille<FragmentBlocs>(chapitre21(), { kind: 'blocs', sec, secOcc: 1, b0, b1 });

  it('monte 2 fragments d\'un même chapitre, textes joints et folios en union', () => {
    const ref = {
      book: LDB, ch: '21',
      parts: [fragment21('peur-indice', 0, 0), fragment21('peur-indice', 1, 1)],
    };
    const res = resoudreAdresse(chapitre21(), ref);
    expect(estErreur(res)).toBe(false);
    const sec = sectionOf('21', 'peur-indice');
    expect((res as Resolu).md).toBe(`${sec.blocks[0].md}\n\n${sec.blocks[1].md}`);
  });

  it('refuse un montage de 4 fragments (plafond 3)', () => {
    const p = [fragment21('peur-indice', 0, 0), fragment21('peur-indice', 1, 1)];
    const res = resoudreAdresse(chapitre21(), { book: LDB, ch: '21', parts: [...p, ...p] });
    expect((res as { error: string }).error).toBe('montage-hors-plafond');
  });

  // `21 - Psychologie.md` : « – Lieselotte Aderhold, Aventurière » fait 34 caractères normalisés.
  it('refuse un fragment de montage trop court pour être discriminant', () => {
    const court = sectionOf('21', 'entre-deux-aventures').blocks[1];
    expect(normText(court.md).length).toBeLessThan(40);
    const res = resoudreAdresse(chapitre21(), {
      book: LDB, ch: '21',
      parts: [fragment21('peur-indice', 0, 0), fragment21('entre-deux-aventures', 1, 1)],
    });
    expect((res as { error: string }).error).toBe('fragment-trop-court');
  });

  // `10 - Talents.md` : « **Tests :** Corps à corps quand vous vous défendez » est le bloc 1 de
  // Renversement ET de Riposte — deux places pour un même texte.
  it('refuse un fragment de montage dupliqué ailleurs dans le chapitre', () => {
    const chapitre = chapitreDe(LDB, '10');
    const frag = (sec: string, b0: number) =>
      estampille<FragmentBlocs>(chapitre, { kind: 'blocs', sec, secOcc: 1, b0, b1: b0 });
    const res = resoudreAdresse(chapitre, {
      book: LDB, ch: '10', parts: [frag('renversement', 1), frag('riposte', 0)],
    });
    expect((res as { error: string }).error).toBe('fragment-ambigu');
    expect((res as { detail: string }).detail).toMatch(/2 fois/);
  });
});

describe('blocsCouverts — ce qu’un fragment CITE DÉJÀ (prédicat unique du chevauchement)', () => {
  // Une CELLULE couvre le bloc de SA table. Une section à DEUX tables est le cas qui distingue le
  // prédicat juste d'une recherche de lignes à travers la section ; banc réel à tables titrées :
  // CRB 070 (`FragmentCellule.table`, plus bas).
  const CHAPITRE = parseChapitre([
    '### Blessures',
    '',
    'Un paragraphe d’ouverture assez long pour être adressable sans ambiguïté dans ce chapitre.',
    '',
    '| Localisation | Effet |',
    '| --- | --- |',
    '| Tete | Assommé jusqu’à la fin du Round suivant, sans autre effet notable. |',
    '',
    'Un second paragraphe, distinct du premier, qui sépare les deux tables de cette section.',
    '',
    '| Localisation | Séquelle |',
    '| --- | --- |',
    '| Bras | Fracture ouverte qui empêche toute action de la main concernée. |',
    '',
  ].join('\n'));
  const section = CHAPITRE.sections.find((s) => s.slug === 'blessures')!;
  const cellule = (row: string, col: string) =>
    estampille<FragmentCellule>(CHAPITRE, { kind: 'cellule', sec: 'blessures', secOcc: 1, row, col });
  const bloc = (i: number) =>
    estampille<FragmentBlocs>(CHAPITRE, { kind: 'blocs', sec: 'blessures', secOcc: 1, b0: i, b1: i });
  const monte = (...parts: Fragment[]) => resoudreAdresse(CHAPITRE, { book: LDB, ch: '00', parts });

  it('la cellule couvre le bloc de SA table, jamais celui de la table voisine', () => {
    // La fixture porte bien DEUX tables : les deux cellules résolvent, chacune dans la sienne.
    expect(section.blocks.filter((b) => b.md.startsWith('|')), 'la fixture doit porter DEUX tables').toHaveLength(2);
    expect((resoudreFragment(CHAPITRE, cellule('Tete', 'Effet')) as Resolu).md).toContain('Assommé');
    expect((resoudreFragment(CHAPITRE, cellule('Bras', 'Séquelle')) as Resolu).md).toContain('Fracture');
    expect([...blocsCouverts(CHAPITRE, cellule('Bras', 'Séquelle'))]).toEqual([3]);
    expect([...blocsCouverts(CHAPITRE, cellule('Tete', 'Effet'))]).toEqual([1]);
  });

  it('la table VOISINE et une cellule se montent ; SA table et elle se recouvrent', () => {
    expect(estErreur(monte(bloc(1), cellule('Bras', 'Séquelle'))), 'deux passages distincts refusés').toBe(false);
    expect((monte(bloc(3), cellule('Bras', 'Séquelle')) as { error: string }).error).toBe('fragments-chevauchants');
  });
});

describe('chargement SOUS NODE NU', () => {
  // Le parseur est importé tel quel par les scripts `.mjs` de `scripts/source/` (migrations, gardes),
  // lancés par `node` sans transpilation : Node 22 efface les types, à condition que les imports
  // internes portent leur extension (`./normalize.ts`, `../hash.ts`).
  it('`node` importe `decoupe.ts` et expose `parseChapitre`', () => {
    const url = new URL('./decoupe.ts', import.meta.url).href;
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `import('${url}').then((m) => console.log(typeof m.parseChapitre))`],
      { encoding: 'utf8' },
    );
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('function');
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * La BANNIÈRE de table (#1384 B1) : l'extraction Marker rend le titre imprimé en
 * BANDEAU comme une rangée devant les en-têtes. `parseTable` l'absorbe SOUS GARDE.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Première table d'un chapitre dont le markdown porte `motif`. */
function tableAvec(bookId: string, ch: string, motif: string): TableParse {
  for (const s of chapitreDe(bookId, ch).sections) {
    for (const b of s.blocks) {
      if (!b.md.includes(motif)) continue;
      const t = parseTable(b.md);
      if (t) return t;
    }
  }
  throw new Error(`aucun bloc-table portant ${JSON.stringify(motif)} dans ${bookId} ch.${ch}`);
}

/** Lecture d'AVANT l'absorption : la bannière passée en MINUSCULES, que la garde refuse alors — le
 *  parseur lui-même rend donc son comportement d'avant, sans qu'aucune définition ne soit recopiée
 *  ici. Les en-têtes NORMALISÉS sont identiques (`normText` replie la casse) : la mesure ci-dessous
 *  compare bien les deux lectures du MÊME chapitre. */
function sansAbsorption(chapitre: ChapitreParse): ChapitreParse {
  const sansTitre = (s: Section): Section => ({
    ...s,
    blocks: s.blocks.map((b) => {
      if (!parseTable(b.md)?.titre) return b;
      const lignes = b.md.split('\n');
      const i = lignes.findIndex((l) => /^\s*\|/.test(l));
      return { ...b, md: lignes.map((l, k) => (k === i ? l.toLowerCase() : l)).join('\n') };
    }),
  });
  return { sections: chapitre.sections.map(sansTitre) };
}

/** Part des cellules de DONNÉE d'un chapitre que `cellRefFor` sait adresser (en %, arrondi). Le
 *  `hit` est bâti à la position exacte de la cellule — c'est la forme que `findCells` rend. */
function pctAdressable(chapitre: ChapitreParse): number {
  let n = 0;
  let ok = 0;
  for (const s of chapitre.sections) {
    for (const { table, cle } of tablesOf(s)) {
      for (const row of table.rows) {
        row.forEach((c, col) => {
          if (!c.trim()) return;
          n++;
          if (cellRefFor(chapitre, { sec: s.slug, secOcc: s.occ, table: cle, headers: table.headers, row, col })) ok++;
        });
      }
    }
  }
  return Math.round((ok / n) * 100);
}

describe('parseTable — la bannière de table, absorbée SOUS GARDE', () => {
  it('`15 - Déplacement.md:18` : le bandeau `TABLEAU DES MOUVEMENTS` est absorbé, les en-têtes RÉELS remontent', () => {
    const t = tableAvec(LDB, '15', 'TABLEAU DES MOUVEMENTS');
    expect(t.titre).toBe('TABLEAU DES MOUVEMENTS');
    expect(t.headers).toEqual(['Mouvement', 'Marche (mètres)', 'Course (mètres)']);
    expect(t.rows[0]).toEqual(['0', '0', '0']);
    expect(t.banniereRefusee).toBeUndefined();
  });

  it('`MDG 16 - Bestiaire.md:606` : un FOLIO capté en rangée n’est pas un titre — rien n’est sauté', () => {
    const t = tableAvec('mer-des-griffes', '16', '| 159 |');
    expect(t.titre).toBeUndefined();
    expect(t.banniereRefusee).toBe('159');
    expect(t.headers).toContain('159');
  });

  it('`AA 13 … :103` : le séparateur d’index `A` (une seule lettre) n’est pas un titre', () => {
    const t = tableAvec('aux-armes', '13', 'Actions de la monture');
    expect(t.titre).toBeUndefined();
    expect(t.banniereRefusee).toBe('A');
    expect(t.headers[0]).toBe('A');
  });

  it('`AA 10 … :337` : `| Effet | |` est l’en-tête RÉEL d’une table à UNE colonne — jamais sauté', () => {
    const t = tableAvec('aux-armes', '10', 'Le Personnage pique un sprint');
    expect(t.titre).toBeUndefined();
    expect(t.banniereRefusee).toBe('Effet');
    expect(t.headers[0]).toBe('Effet');
    expect(t.rows[0][0]).toContain('pique un sprint');
  });

  it('`46 - Les règles magiques.md:34` : un bandeau devant une table SANS en-têtes n’est pas absorbé', () => {
    // La bannière est en MAJUSCULES et la table a des rangées : les deux premiers volets de la garde
    // l'absorberaient. Le troisième la refuse, parce que la ligne suivante est une DONNÉE (fourchette
    // d100) et non des en-têtes — l'absorber promouvrait `01-05` en en-tête et volerait une rangée.
    const t = tableAvec(LDB, '46', 'TABLEAU DES INCANTATIONS IMPARFAITES MINEURES');
    expect(t.titre).toBeUndefined();
    expect(t.banniereRefusee).toBe('TABLEAU DES INCANTATIONS IMPARFAITES MINEURES');
    expect(t.rows[0][0]).toBe('01-05');
    expect(t.headers[0]).toBe('');
  });

  it('CONTRAT POSITIF : l’absorption rend adressables des cellules qui ne l’étaient pas', () => {
    // Chiffres MESURÉS sur l'arbre à la livraison de #1384 B1 (jamais un « ≥ 90 % » complaisant) :
    // les deux lectures du même chapitre sont imprimées, et toutes deux épinglées.
    for (const m of [
      { ch: '15', fichier: '15 - Déplacement.md', avant: 28, apres: 64 },
      { ch: '61', fichier: '61 - Encombrement.md', avant: 65, apres: 93 },
    ]) {
      const chapitre = chapitreDe(LDB, m.ch);
      const avant = pctAdressable(sansAbsorption(chapitre));
      const apres = pctAdressable(chapitre);
      console.log(`BANNIÈRE — ${m.fichier} : ${avant} % → ${apres} % des cellules de donnée adressables`);
      expect(avant, `${m.fichier} : lecture d’AVANT l’absorption`).toBe(m.avant);
      expect(apres, `${m.fichier} : lecture COURANTE`).toBe(m.apres);
    }
  });
});

/* Le `<br>` de cellule (#1384 B2), sur le SITE RÉEL `07 - Carrieres.md:49`, section
 * « Coût des changements de Carrière et de Talent » : UNE seule table (donc aucune ambiguïté de clé),
 * et elle porte les deux formes à la fois — une CLÉ coupée (`Quitter une Carrière<br>Achevée`) et une
 * CELLULE non-clé coupée (`100 PX +100 PX par fois où<br>le Talent a déjà été pris`). Mesuré le
 * 2026-09-14 sur les 16 livres : 149 clés et 1267 cellules non-clé à `<br>` vivent dans une section à
 * une seule table — aucune fixture n'est nécessaire. */
const SEC_BR = 'cout-des-changements-de-carriere-et-de-talent';

describe('`<br>` de cellule — saut de ligne IMPRIMÉ : absorbé à l’adressage, rendu en `\\n`', () => {
  const chapitre = () => chapitreDe(LDB, '07');
  const frag = (row: string, col: string) =>
    resoudreFragment(
      chapitre(),
      estampille<FragmentCellule>(chapitre(), { kind: 'cellule', sec: SEC_BR, secOcc: 1, row, col }),
    );

  it('une CLÉ de ligne coupée par un `<br>` est adressable telle qu’elle se LIT', () => {
    // L'adresse porte la clé IMPRIMÉE (« Quitter une Carrière Achevée »), jamais la balise d'extraction.
    const res = frag('Quitter une Carrière Achevée', 'Coût en PX');
    expect(estErreur(res)).toBe(false);
    expect((res as Resolu).md).toBe('100 PX');
    expect((res as Resolu).folios).toContain(49);
  });

  it('une CELLULE à `<br>` rend le SAUT qu’elle imprime, jamais la balise (règle 5)', () => {
    const res = frag('+1 Augmentation de Talent', 'Coût en PX');
    expect(estErreur(res)).toBe(false);
    expect((res as Resolu).md).toBe('100 PX +100 PX par fois où\nle Talent a déjà été pris');
    expect((res as Resolu).md).not.toContain('<br>');
  });

  it('le md d’un fragment de BLOCS ne porte plus de `<br>` sur ses lignes de table (rendu GFM)', () => {
    const res = blocs('07', SEC_BR, 0, 0);
    expect(estErreur(res)).toBe(false);
    expect((res as Resolu).md).not.toContain('<br>');
    expect((res as Resolu).md).toContain('Quitter une Carrière Achevée');
  });

  it('ANGLE MORT DIT : `normText` (donc `sumOf`) est AVEUGLE au `<br>` — les deux formes ont la même empreinte', () => {
    expect(normText('Quitter une Carrière<br>Achevée')).toBe(normText('Quitter une Carrière Achevée'));
    expect(sumOf('| a<br>b |')).toBe(sumOf('| a b |'));
  });
});

describe('TITRE de table (#1739) — bannière absorbée, ou légende `**X**` du bloc qui précède', () => {
  const CRB = 'core-rulebook-5e';
  const section = (ch: string, slug: string) => chapitreDe(CRB, ch).sections.find((s) => s.slug === slug)!;

  it('CRB 088 : la légende `**PACKS AND CONTAINERS**` titre sa table, et la prose qui suit reste dans SA section', () => {
    const s = section('088', 'packs-and-containers');
    expect(chapitreDe(CRB, '088').sections.filter((x) => x.slug === 'packs-and-containers')).toHaveLength(1);
    expect(tablesOf(s).map((t) => [t.table.titre, t.cle])).toEqual([['PACKS AND CONTAINERS', 'packs and containers#1']]);
    expect(s.blocks.some((b) => b.md.startsWith('**Backpack:**'))).toBe(true);
  });

  it('CRB 036 : `**HIT LOCATIONS**` titre la table de la section « 2: Determine Hit Location »', () => {
    const s = section('036', '2-determine-hit-location');
    expect(tablesOf(s).map((t) => t.table.titre)).toEqual(['HIT LOCATIONS']);
  });

  it('CRB 040 : légende au-dessus d’une table à en-tête VIDE — aucune rangée perdue', () => {
    const [t] = tablesOf(section('040', 'dosage'));
    expect([t.table.titre, t.table.headers, t.table.rows[0], t.table.banniereRefusee])
      .toEqual(['CREATURE SIZE AND DOSAGE', ['', ''], ['Tiny', 'A single dose counts as 10 doses.'], undefined]);
  });

  it('un `**X**` suivi d’une ligne VIDE puis d’un paragraphe n’est pas une légende ; la bannière absorbée prime', () => {
    const [s] = parseChapitre(['**X**', '', 'Prose.', '', '| a | b |', '|---|---|', '| 1 | 2 |', '', '**Y**', '', '| | BANDEAU | |', '|--|--|--|', '| c | d | e |', '| 3 | 4 | 5 |'].join('\n')).sections;
    expect(tablesOf(s).map((t) => [t.table.titre, t.cle])).toEqual([[undefined, undefined], ['BANDEAU', 'bandeau#1']]);
  });

  // #1739 #1970 : hors CRB, la légende `**X**` au-dessus d'une table est lue comme son titre.
  const titresDe = (livre: string, ch: string) => chapitreDe(livre, ch).sections.flatMap((s) => tablesOf(s)).map((t) => t.table.titre);

  it.each([
    'Hexenstag - Jour du Nouvel An',
    'Geheimnistag - Le Jour des Mystères',
    "Mittherbst - Équinoxe d'automne",
    "Mondstille - Solstice d'hiver",
  ])('ennemi-dans-l-ombre ch.12 : « %s » est lu titre de la table qui suit', (titre) => {
    expect(titresDe('ennemi-dans-l-ombre', '12')).toContain(titre);
  });

  it('aventures-a-ubersreik-1 ch.25 : « A » est lu titre de la table qui suit', () => {
    expect(titresDe('aventures-a-ubersreik-1', '25')).toContain('A');
  });
});

describe('FragmentCellule.table (#1739) — une clé de ligne ambiguë entre tables se résout dans SA table', () => {
  const chapitre = () => chapitreDe('core-rulebook-5e', '070');
  const brouillon = (table?: string) =>
    estampille<FragmentCellule>(chapitre(), { kind: 'cellule', sec: 'multiple-arcane-lores', secOcc: 1, row: '05 or less', col: 'Effect', ...(table ? { table } : {}) });

  it('CRB 070 : « 05 or less » est dans les DEUX tables de miscast — sans `table`, ambiguë ; avec, résolue', () => {
    expect((resoudreFragment(chapitre(), brouillon()) as { error: string }).error).toBe('ligne-ambigue');
    expect((resoudreFragment(chapitre(), brouillon('major miscast table#1')) as Resolu).md).toMatch(/^Jibbering/);
    expect((resoudreFragment(chapitre(), brouillon('minor miscast table#1')) as Resolu).md).toMatch(/^Cloyed Tongue/);
  });

  it('`cellRefFor` pose `table` QUAND la clé est ambiguë, et seulement alors', () => {
    const [hit] = findCells(chapitre(), normText(
      'Jibbering: You gabble unintelligibly for 1d10 Rounds. During this time, you cannot communicate verbally or use the Language Skill, although you may otherwise act normally.'));
    expect(cellRefFor(chapitre(), hit)).toMatchObject({ row: '05 or less', col: 'Effect', table: 'major miscast table#1' });
    const [unique] = findCells(chapitreDe(LDB, '19'), normText('+1 Mouvement'));
    expect(cellRefFor(chapitreDe(LDB, '19'), unique)).not.toHaveProperty('table');
  });
});
