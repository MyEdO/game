// Tests du DÉCIDEUR DE TEXTE d'une adresse (#1887, lot 6a-2a) : les unités que le rendu produit
// (`unitesDe`), la préparation d'un texte libre (`unitesDuTexte`), `aligner` et la décision de `judge`
// (`scripts/source/derive-decoupes.mjs`). Les volets « dépôt » lisent les adresses stockées et le VRAI
// `Source/` ; les forges et la composition des cas-limites lisent une fixture.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ChapitreParse, type DescRef, type Fragment, type Unite,
  MIN_FRAGMENT, aligner, estErreur, fragmentBlocs, fragmentCellule, findAllRuns, findCells, joinNorm, memeTexte, normText, parseChapitre,
  resoudreAdresse, tablesOf, unitesDe, unitesDuBloc, unitesDuTexte,
} from './decoupe.ts';
import { adressesDuDepot } from '../../../scripts/source/adresses.mjs';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { chapitresDe, lireChapitre } from '../../../scripts/source/lecteur-fs.mjs';
// @ts-expect-error - dérivation ESM JS (pas de types) — même convention que `vite.config.ts`
import { PRESENTE_AU_LIVRE, judge, verifier } from '../../../scripts/source/derive-decoupes.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const LDB = 'livre-de-base';

/** Entrée d'un dataset, lue au disque. */
function entree(dataset: string, id: string): Record<string, unknown> {
  const data = JSON.parse(readFileSync(join(RACINE, 'src', 'data', `${dataset}.json`), 'utf8')) as Record<string, unknown>[];
  const e = data.find((x) => x.id === id);
  if (!e) throw new Error(`${dataset}:${id} introuvable`);
  return e;
}

/** Chapitres d'un livre, dans l'ordre. */
const chapitresDuLivre = (book: string): string[] => chapitresDe(book);

/** Chapitre stocké par une adresse. */
const chapitreDe = (book: string, ch: string): ChapitreParse => {
  const c = lireChapitre(book, ch);
  if (!c) throw new Error(`chapitre introuvable : ${book} ch.${ch}`);
  return c;
};

/** Unités d'un fragment ; lève sur une erreur de résolution. */
function unites(chapitre: ChapitreParse, frag: Fragment): Unite[] {
  const u = unitesDe(chapitre, frag);
  if (estErreur(u)) throw new Error(`${u.error} : ${u.detail}`);
  return u.unites;
}

/** Le rendu assemblé des unités. */
const assemble = (us: Unite[]): string => us.map((u) => u.sep + u.md).join('');
const normDe = (us: readonly Unite[]): string => joinNorm(us.map((u) => u.norm));

/** Verdict de `judge` sur une desc PARTIE STRICTE d'un bloc. */
const SOUS_BLOC = { verdict: 'ECHEC', reason: 'sous-bloc (desc = fragment d\'un bloc)' };

/** Fixture : un bloc-table à bannière, une légende et sa table (mêmes clés), une cellule à `<br>`, un
 *  bloc à ligne vide interne (marqueur de page seul sur sa ligne), un bloc de prose. */
const FIXTURE = [
  '# Essais',
  '',
  "Paragraphe d'ouverture assez long pour être un bloc de prose ordinaire et adressable.",
  '',
  '| | TABLEAU DES ESSAIS | |',
  '|---|---|---|',
  '| Clé | Effet | Note |',
  '|---|---|---|',
  '| Tête | Assommé<br>deux rounds | a |',
  '| Bras | Fracture | b |',
  '',
  '**Table des rechutes**',
  '',
  '| Clé | Effet | Note |',
  '|---|---|---|',
  '| Tête | Migraine | c |',
  '| Bras | Entorse | d |',
  '',
  'Texte avant le saut',
  '<span id="page-3-0"></span>',
  'Texte après le saut, dans le même bloc.',
  '',
  'Dernier paragraphe de la section, lui aussi assez long pour être adressable seul.',
  '',
].join('\n');
const CHAPITRE = parseChapitre(FIXTURE);
const ESSAIS = CHAPITRE.sections.find((s) => s.slug === 'essais')!;
const blocs = (b0: number, b1: number) => fragmentBlocs(CHAPITRE, { sec: 'essais', secOcc: 1, b0, b1 });
const cellule = (row: string, col: string, table: string) =>
  fragmentCellule(CHAPITRE, { sec: 'essais', secOcc: 1, row, col, table });
const [CLE_ESSAIS, CLE_RECHUTES] = tablesOf(ESSAIS).map((t) => t.cle!);

const ADRESSES = adressesDuDepot()
  .map((a) => a.ref as DescRef)
  .filter((r) => r && Array.isArray(r.parts));

describe('1. composition : le rendu est l’assemblage de ses unités, sa norme leur jointure', () => {
  it('sur chaque fragment et chaque adresse stockés', () => {
    expect(ADRESSES.length).toBeGreaterThan(0);
    for (const ref of ADRESSES) {
      const c = chapitreDe(ref.book, ref.ch);
      const res = resoudreAdresse(c, ref);
      if (estErreur(res)) throw new Error(`${ref.book} ${ref.ch} : ${res.error}`);
      const us = ref.parts.flatMap((p) => unites(c, p));
      expect(normText(res.md), `${ref.book} ${ref.ch}`).toBe(normDe(us));
      for (const p of ref.parts) expect(normText(assemble(unites(c, p)))).toBe(normDe(unites(c, p)));
    }
  });

  it('sur la fixture : bannière, légende, cellule à `<br>`, ligne vide interne', () => {
    const lus = ESSAIS.blocks.map((_, i) => unites(CHAPITRE, blocs(i, i)));
    expect(lus.map((us) => us[0].kind)).toEqual(['bloc', 'ligne', 'bloc', 'ligne', 'bloc', 'bloc']);
    expect(ESSAIS.blocks[4].md).toContain('\n\n');
    for (const us of [...lus, unites(CHAPITRE, blocs(0, ESSAIS.blocks.length - 1)), unites(CHAPITRE, cellule('Tête', 'Effet', CLE_ESSAIS))]) {
      expect(normText(assemble(us))).toBe(normDe(us));
    }
    expect(unites(CHAPITRE, cellule('Tête', 'Effet', CLE_ESSAIS))[0].md).toBe('Assommé\ndeux rounds');
  });

  it('les unités mémoïsées d’un bloc sont gelées : un appelant ne corrompt pas le mémo', () => {
    const [u] = unites(CHAPITRE, blocs(0, 0));
    expect(() => { (u as { md: string }).md = 'x'; }).toThrow(TypeError);
    expect(() => { (u.pos as { rang: number }).rang = 9; }).toThrow(TypeError);
    expect(() => { (unitesDuBloc(ESSAIS, 0) as Unite[]).push(u); }).toThrow(TypeError);
    const md = ESSAIS.blocks[0].md;
    expect(unites(CHAPITRE, blocs(0, 0))[0]).toEqual({ md, sep: '', norm: normText(md), pos: { sec: 'essais', secOcc: 1, rang: 0 }, kind: 'bloc' });
  });

  it('sur les textes libres des fixtures', () => {
    for (const md of [...ESSAIS.blocks.map((b) => b.md), '***\n\nUn paragraphe.\n\n**']) {
      expect(normDe(unitesDuTexte(md))).toBe(normText(md));
    }
    // Une ligne de titre est traduite (ci-dessous) : la norme est celle du texte traduit.
    expect(normDe(unitesDuTexte(FIXTURE))).toBe(normText(FIXTURE.replace('# Essais', '**Essais**')));
  });

  it('une ligne de titre markdown du texte libre devient le titre du fil, en gras', () => {
    const [titre, paragraphe] = unitesDuTexte(FIXTURE);
    expect(titre.md).toBe('**Essais**');
    expect(paragraphe.md).toBe(ESSAIS.blocks[0].md);
    expect(unitesDuTexte('### **Titre** ##\nsuite du paragraphe')[0].md).toBe('**Titre**\nsuite du paragraphe');
  });
});

describe('2. aller-retour : chaque fragment et chaque adresse stockés repassent par `judge`', () => {
  const ADOPTABLES = ['EXACT', 'EXACT-MULTI-SECTIONS', 'MONTAGE', 'CELLULE'];
  /** Nombre de places du livre où ce texte se lit à l'identique (runs de blocs et cases). */
  const placesDuLivre = (book: string, md: string): number => chapitresDuLivre(book).reduce((n, ch) => {
    const c = chapitreDe(book, ch);
    return n + findAllRuns(c, normText(md)).length + findCells(c, normText(md)).length;
  }, 0);
  const cas = ADRESSES.flatMap((ref) => [ref, ...(ref.parts.length > 1 ? ref.parts.map((p) => ({ ...ref, parts: [p] })) : [])]);

  it.each(cas.map((ref) => [`${ref.book} ${ref.ch} ${JSON.stringify(ref.parts.map((p) => (p.kind === 'blocs' ? `${p.sec}:${p.b0}-${p.b1}` : `${p.sec}:${p.row}×${p.col}`)))}`, ref] as const))('%s', (_, ref) => {
    const res = resoudreAdresse(chapitreDe(ref.book, ref.ch), ref);
    if (estErreur(res)) throw new Error(`${res.error} : ${res.detail}`);
    const j = judge({ source: { book: ref.book }, desc: res.md });
    expect(ADOPTABLES).toContain(j.verdict);
    expect(j.verification).toBeUndefined();
    const rendu = resoudreAdresse(chapitreDe(j.ref.book, j.ref.ch), j.ref);
    expect(!estErreur(rendu) && memeTexte(rendu.md, res.md)).toBe(true);
    if (ref.parts.every((p) => {
      const r = resoudreAdresse(chapitreDe(ref.book, ref.ch), { ...ref, parts: [p] });
      return !estErreur(r) && placesDuLivre(ref.book, r.md) === 1;
    })) {
      expect({ ch: j.ref.ch, parts: j.ref.parts }).toEqual({ ch: ref.ch, parts: ref.parts });
    }
  });
});

describe('3. aligner', () => {
  const adresse = unitesDuTexte('Alpha beta\n\nGamma delta\n\nEpsilon zeta');
  const nomme = (unite: number, cote: string) => expect.objectContaining({ unite, cote });

  it('égalité : rien d’ajouté', () => {
    const al = aligner(unitesDuTexte('alpha BETA\n\ngamma   delta\n\nepsilon zeta'), adresse);
    expect(al).toEqual({ couvertes: { premiere: { unite: 0, coupe: 0 }, derniere: { unite: 2, coupe: 12 } }, ajoute: [] });
  });

  it('partie stricte à gauche, à droite, au milieu : restes nommés', () => {
    expect(aligner(unitesDuTexte('Epsilon zeta'), adresse)?.ajoute).toEqual([nomme(0, 'entiere'), nomme(1, 'entiere')]);
    expect(aligner(unitesDuTexte('Alpha beta'), adresse)?.ajoute).toEqual([nomme(1, 'entiere'), nomme(2, 'entiere')]);
    expect(aligner(unitesDuTexte('Gamma delta'), adresse)?.ajoute).toEqual([nomme(0, 'entiere'), nomme(2, 'entiere')]);
    const coupe = aligner(unitesDuTexte('beta gamma'), adresse)!;
    expect(coupe.couvertes).toEqual({ premiere: { unite: 0, coupe: 6 }, derniere: { unite: 1, coupe: 5 } });
    expect(coupe.ajoute).toEqual([nomme(0, 'gauche'), nomme(1, 'droite'), nomme(2, 'entiere')]);
    expect(aligner(unitesDuTexte('lpha beta'), adresse)?.ajoute, 'coupe à un caractère').toEqual([nomme(0, 'gauche'), nomme(1, 'entiere'), nomme(2, 'entiere')]);
    expect(aligner(unitesDuTexte('Alpha bet'), adresse)?.ajoute, 'coupe à un caractère').toEqual([nomme(0, 'droite'), nomme(1, 'entiere'), nomme(2, 'entiere')]);
    expect(aligner(unitesDuTexte('mma del'), adresse)?.ajoute).toEqual([nomme(0, 'entiere'), nomme(1, 'gauche'), nomme(1, 'droite'), nomme(2, 'entiere')]);
  });

  it('un ajout porte la position et la nature de l’unité, jamais son texte', () => {
    const [ajout] = aligner(unitesDuTexte('Epsilon zeta'), adresse)!.ajoute;
    expect(ajout).toEqual({ unite: 0, pos: { rang: 0 }, kind: 'paragraphe', cote: 'entiere' });
  });

  it('une unité d’adresse de norme vide n’est jamais un ajout', () => {
    const vide: Unite = { md: '**', sep: '\n\n', norm: '', pos: { rang: 9 }, kind: 'bloc' };
    expect(aligner(unitesDuTexte('Alpha beta\n\nGamma delta\n\nEpsilon zeta'), [...adresse, vide])?.ajoute).toEqual([]);
  });

  it('texte absent : null ; texte vide : refusé', () => {
    expect(aligner(unitesDuTexte('Omega'), adresse)).toBeNull();
    expect(() => aligner(unitesDuTexte('**'), adresse)).toThrow(/texte sans unité de contenu/);
  });
});

describe('4. forges : une adresse qui ne rend pas le texte porte sa `verification`', () => {
  const texte = (frag: Fragment) => unitesDuTexte(assemble(unites(CHAPITRE, frag)));
  const ref = (parts: Fragment[]): DescRef => ({ book: 'fixture', ch: '01', parts });

  it('l’adresse juste passe', () => {
    expect(verifier(CHAPITRE, ref([blocs(0, 0)]), texte(blocs(0, 0)))).toBeUndefined();
    expect(verifier(CHAPITRE, ref([cellule('Tête', 'Effet', CLE_ESSAIS)]), texte(cellule('Tête', 'Effet', CLE_ESSAIS)))).toBeUndefined();
  });

  it('cible décalée d’un bloc, mauvaise table, cible élargie d’un bloc', () => {
    expect(verifier(CHAPITRE, ref([blocs(1, 1)]), texte(blocs(0, 0)))).toBe('texte re-résolu != desc');
    expect(verifier(CHAPITRE, ref([cellule('Tête', 'Effet', CLE_RECHUTES)]), texte(cellule('Tête', 'Effet', CLE_ESSAIS)))).toBe('texte re-résolu != desc');
    expect(verifier(CHAPITRE, ref([blocs(0, 1)]), texte(blocs(0, 0)))).toBe('texte re-résolu != desc');
  });
});

describe('Z1. sous-bloc : une partie stricte d’un bloc-table, reconstruite depuis le Source', () => {
  it('le bloc-table adressé par `regles:surincantation-des-sorts-d-augure`, privé de sa dernière ligne, est un « sous-bloc »', () => {
    const e = { ...entree('regles', 'surincantation-des-sorts-d-augure') };
    const ref = e.descRef as DescRef;
    const rendu = resoudreAdresse(lireChapitre(ref.book, ref.ch), ref);
    if (estErreur(rendu)) throw new Error(rendu.detail);
    delete e.descRef;
    expect(judge({ ...e, desc: rendu.md.split('\n').slice(0, -1).join('\n') })).toEqual(SOUS_BLOC);
  });
});

describe('5-6. verdicts du dépôt', () => {
  it.each(['saltimbanque', 'chansonnier', 'ratisseur-de-plages'])('`careers:%s` reste un MONTAGE', (id) => {
    const j = judge(entree('careers', id));
    expect(j.verdict).toBe('MONTAGE');
    expect(j.verification).toBeUndefined();
  });
});

describe('8. plancher de « sous-bloc » : `MIN_FRAGMENT` caractères au moins', () => {
  const MALEPIERRE = String(entree('trappings', 'malepierre-brute').desc);

  it('`malepierre-brute` (`MIN_FRAGMENT` caractères, incluse dans un bloc) : « sous-bloc »', () => {
    expect(normText(MALEPIERRE)).toHaveLength(MIN_FRAGMENT);
    expect(judge(entree('trappings', 'malepierre-brute'))).toEqual(SOUS_BLOC);
  });

  it('un caractère de moins, inclus dans un bloc : pas « sous-bloc », et sans orpheline (B3)', () => {
    const cible = normText(MALEPIERRE);
    const court = [0, 1, 2, 3, 4].map((k) => cible.slice(k, k + MIN_FRAGMENT - 1))
      .find((t) => normText(t).length === MIN_FRAGMENT - 1) ?? '';
    expect(normText(court)).toHaveLength(MIN_FRAGMENT - 1);
    expect(judge({ source: { book: LDB }, desc: court }).reason).toBe(PRESENTE_AU_LIVRE);
  });
});

describe('9. unités vides', () => {
  it('une desc sans unité de contenu est vide', () => {
    expect(judge({ source: { book: LDB }, desc: '**' })).toEqual({ verdict: 'ECHEC', reason: 'desc-vide' });
  });

  it('la raison cite le paragraphe absent, jamais une unité vide', () => {
    const j = judge({ source: { book: LDB }, desc: '***\n\nCe paragraphe zqxw ne figure dans aucun livre du dépôt.' });
    expect(j).toEqual({ verdict: 'ECHEC', reason: 'introuvable: « ce paragraphe zqxw ne figure dans aucun livre du dépôt. »' });
  });
});
