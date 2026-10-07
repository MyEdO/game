// ORACLE de la relation de texte étendue (#1887 lot 6a-2b T3) : `aligner` ignore la syntaxe des deux
// côtés (D4), consomme ENTIÈRE ou saute une unité d'habillage d'adresse (D5), découpe un paragraphe
// par la même fonction des deux côtés (D3), lève sur un texte sans contenu (D6) ; une localisation ne
// commence ni ne finit sur un habillage (B4) ; l'orpheline de `judge` est définie par la relation (B3).
// Table d'oracle corrigée de #1887, cas 1 à 12. Les sources sont le VRAI `Source/` ; les forges `Fs` et
// `Fb` sont GÉNÉRÉES depuis le corpus, jamais recopiées.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  type Alignement, type ChapitreParse, type Section, type Unite,
  aligner, estDeContenu, estErreur, estSeparateur, fragmentBlocs, parseTable, unitesDe, unitesDuBloc, unitesDuTexte,
} from './decoupe.ts';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { chapitresDe, lireChapitre } from '../../../scripts/source/lecteur-fs.mjs';
// @ts-expect-error - dérivation ESM JS (pas de types) — même convention que `vite.config.ts`
import { PRESENTE_AU_LIVRE, contenueNonProposee, judge } from '../../../scripts/source/derive-decoupes.mjs';
// @ts-expect-error - bibliothèque RAW ESM JS (pas de types) — même convention que `vite.config.ts`
import { BOOKS, livreDuSigle } from '../../../scripts/raw/_lib.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const NL = '\n';
const livre = (abbr: string): string => livreDuSigle(abbr).id;

/** Une section par son slug : dans le chapitre `ch`, ou le premier chapitre du livre qui la porte. */
function section(book: string, slug: string, occ: number, ch?: string): { c: ChapitreParse; s: Section } {
  for (const n of ch == null ? chapitresDe(book) as string[] : [ch]) {
    const c = lireChapitre(book, n) as ChapitreParse | null;
    const s = c?.sections.find((x) => x.slug === slug && x.occ === occ);
    if (c && s) return { c, s };
  }
  throw new Error(`${book} : section ${slug}#${occ} introuvable`);
}

/** Unités d'adresse des blocs `b0`-`b1` d'une section. */
function adresse({ c, s }: { c: ChapitreParse; s: Section }, b0: number, b1: number): Unite[] {
  const u = unitesDe(c, fragmentBlocs(c, { sec: s.slug, secOcc: s.occ, b0, b1 }));
  if (estErreur(u)) throw new Error(`${u.error} : ${u.detail}`);
  return u.unites;
}

/** Le rendu (`sep + md`) des blocs `b0`-`b1`. */
const rendu = (lieu: { c: ChapitreParse; s: Section }, b0: number, b1: number): string =>
  adresse(lieu, b0, b1).map((u) => u.sep + u.md).join('');

/** Un ajout nommé : nature, rang, ligne, habillage, côté. */
const nom = (a: Alignement['ajoute'][number]): string =>
  `${a.kind}@${a.pos.rang}${a.pos.ligne == null ? '' : `.${a.pos.ligne}`}${a.habillage ? '(hab)' : ''}:${a.cote}`;

/** Unités d'adresse TOUCHÉES : les unités de contenu moins celles ajoutées entières. */
const touchees = (al: Alignement, a: readonly Unite[]): number =>
  a.filter(estDeContenu).length - al.ajoute.filter((x) => x.cote === 'entiere').length;

/** Aligne `texte` (libre) sur `a` ; lève si rien ne s'aligne. */
function aligne(texte: string, a: readonly Unite[]): Alignement {
  const al = aligner(unitesDuTexte(texte), a);
  if (!al) throw new Error('aucun alignement');
  return al;
}

describe('1, 1b. la séparatrice est de la SYNTAXE, ignorée des deux côtés (D2, D4)', () => {
  it('1 : `|-|-|` contre la séparatrice du livre : égalité, 6 unités touchées ; judge EXACT', () => {
    const lieu = section(livre('LDB'), 'tableau-des-races-aleatoires', 1, '04');
    const md = rendu(lieu, 0, 0);
    const forge = md.split(NL).map((l) => (estSeparateur(l) ? `|${l.split('|').slice(1, -1).map(() => '-').join('|')}|` : l)).join(NL);
    expect(forge).not.toBe(md);
    const al = aligne(forge, adresse(lieu, 0, 0));
    expect(al.ajoute).toEqual([]);
    expect(touchees(al, adresse(lieu, 0, 0))).toBe(6);
    expect(judge({ source: { book: livre('LDB') }, desc: forge }).verdict).toBe('EXACT');
  });

  it('1b : une cellule vide refuse la séparatrice (`|--||`), un tiret par cellule suffit (`|-|-|`)', () => {
    expect(estSeparateur('|--||')).toBe(false);
    expect(estSeparateur('|-|-|')).toBe(true);
  });
});

describe('2. D3 : un paragraphe-table du texte se découpe comme un bloc-table, une ligne = une unité', () => {
  it.each([
    ['classes', 1, 6, 34],
    ['mouvement-m', 1, 0, 5],
    ['elfes-sylvains', 2, 1, 18],
  ] as const)('LDB %s#%i b%i + b suivant, joints par UN saut : égalité, %i unités touchées', (slug, occ, b, n) => {
    const lieu = section(livre('LDB'), slug, occ);
    const mixte = lieu.s.blocks[b].md + NL + lieu.s.blocks[b + 1].md;
    expect(parseTable(mixte)).not.toBeNull();
    const texte = unitesDuTexte(mixte);
    expect(texte).toHaveLength(mixte.split(NL).length);
    expect(texte.every((u) => u.kind === 'ligne')).toBe(true);
    const al = aligne(mixte, adresse(lieu, b, b + 1));
    expect(al.ajoute).toEqual([]);
    expect(touchees(al, adresse(lieu, b, b + 1))).toBe(n);
    expect(judge({ source: { book: livre('LDB') }, desc: mixte }).verdict).toBe('EXACT');
  });
});

describe('3. D6 : un texte sans contenu', () => {
  it('`|--|` : `aligner` lève (`RangeError`) ; judge passe d’EXACT à ECHEC « desc-vide » (verdict NOMMÉ)', () => {
    const lieu = section(livre('EDO'), 'betail-en-liberte', 2, '06');
    expect(lieu.s.blocks[1].md).toBe('|--|');
    expect(unitesDuBloc(lieu.s, 1).filter(estDeContenu)).toEqual([]);
    expect(() => aligner(unitesDuTexte('|--|'), adresse(lieu, 0, lieu.s.blocks.length - 1))).toThrow(RangeError);
    expect(judge({ source: { book: livre('EDO') }, desc: '|--|' })).toEqual({ verdict: 'ECHEC', reason: 'desc-vide' });
  });
});

describe('4, 4b. D5 : la bannière absorbée est une unité d’HABILLAGE, sautée quand la desc l’omet', () => {
  const NOUVELLE = 'scripts/migrations/2026-10-06-1887-regles-navigation-progression.mjs';
  const git = (...args: string[]) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 26 });
  /** La desc de `regles:navigation-progression` au PARENT du commit qui ajoute sa migration (`HEAD` avant). */
  const desc = (): string => {
    const ajout = git('log', '--diff-filter=A', '--format=%H', '--', NOUVELLE).trim().split(NL).filter(Boolean).pop();
    const regles = JSON.parse(git('show', `${ajout ? `${ajout}^` : 'HEAD'}:src/data/regles.json`)) as { id: string; desc?: string }[];
    return regles.find((e) => e.id === 'navigation-progression')!.desc!;
  };
  const lieu = () => section(livre('MDG'), 'irregularites-numeriques', 1, '13');

  it('la ligne de bannière du bloc-table est habillage, et elle seule', () => {
    const us = unitesDuBloc(lieu().s, 5);
    expect(us.map((u) => Boolean(u.habillage))).toEqual(us.map((_, i) => i === 0));
  });

  it('4 : la desc réelle contre les blocs 4-5 : 7 unités touchées, la bannière sautée ; contre le bloc 5 seul : rien', () => {
    const al = aligne(desc(), adresse(lieu(), 4, 5));
    expect(al.ajoute.map(nom)).toEqual(['ligne@5.0(hab):entiere']);
    expect(touchees(al, adresse(lieu(), 4, 5))).toBe(7);
    expect(aligner(unitesDuTexte(desc()), adresse(lieu(), 5, 5))).toBeNull();
  });

  it('4 : judge ECHEC, la desc a pour lieu une SUITE de 2 blocs que les chercheurs ne proposent pas (B1)', () => {
    expect(judge({ source: { book: livre('MDG') }, desc: desc() })).toEqual({ verdict: 'ECHEC', reason: contenueNonProposee(2) });
  });

  it('4b : le bloc 5 privé de sa bannière : la bannière sautée ; judge « sous-bloc »', () => {
    const forge = lieu().s.blocks[5].md.split(NL).slice(1).join(NL);
    const al = aligne(forge, adresse(lieu(), 5, 5));
    expect(al.ajoute.map(nom)).toEqual(['ligne@5.0(hab):entiere']);
    expect(touchees(al, adresse(lieu(), 5, 5))).toBe(6);
    expect(judge({ source: { book: livre('MDG') }, desc: forge })).toEqual({ verdict: 'ECHEC', reason: 'sous-bloc (desc = fragment d\'un bloc)' });
  });
});

describe('5-5d. la LÉGENDE posée par `tablesOf` est une unité d’habillage ; un bloc gras qui n’en est pas une reste du contenu', () => {
  const lieu = () => section(livre('CRB'), '1-species', 1);

  it('le bloc 2 (légende de la table du bloc 3) est habillage ; les lignes de la table ne le sont pas', () => {
    expect(unitesDuBloc(lieu().s, 2).map((u) => Boolean(u.habillage))).toEqual([true]);
    expect(unitesDuBloc(lieu().s, 3).some((u) => u.habillage)).toBe(false);
  });

  it('5 : desc = blocs 2-3 contre 2-3 : la légende consommée, rien d’ajouté ; judge EXACT', () => {
    const al = aligne(rendu(lieu(), 2, 3), adresse(lieu(), 2, 3));
    expect(al.ajoute).toEqual([]);
    expect(touchees(al, adresse(lieu(), 2, 3))).toBe(7);
    expect(judge({ source: { book: livre('CRB') }, desc: rendu(lieu(), 2, 3) }).verdict).toBe('EXACT');
  });

  it('5b : desc = bloc 3 contre 2-3 : la légende sautée ; judge EXACT adresse le bloc 3 seul', () => {
    const al = aligne(rendu(lieu(), 3, 3), adresse(lieu(), 2, 3));
    expect(al.ajoute.map(nom)).toEqual(['bloc@2(hab):entiere']);
    expect(touchees(al, adresse(lieu(), 2, 3))).toBe(6);
    const j = judge({ source: { book: livre('CRB') }, desc: rendu(lieu(), 3, 3) });
    expect(j.verdict).toBe('EXACT');
    expect(j.ref.parts[0]).toMatchObject({ sec: '1-species', secOcc: 1, b0: 3, b1: 3 });
  });

  it('5c (B4) : la légende SEULE contre 2-3 s’aligne mais ne LOCALISE rien (`couvertes` nul) ; judge EXACT sur le bloc 2', () => {
    const al = aligne(rendu(lieu(), 2, 2), adresse(lieu(), 2, 3));
    expect(touchees(al, adresse(lieu(), 2, 3))).toBe(1);
    expect(al.ajoute.map(nom)).toEqual([0, 2, 3, 4, 5, 6].map((l) => `ligne@3.${l}:entiere`));
    expect(al.couvertes).toBeNull();
    const j = judge({ source: { book: livre('CRB') }, desc: rendu(lieu(), 2, 2) });
    expect(j.verdict).toBe('EXACT');
    expect(j.ref.parts[0]).toMatchObject({ b0: 2, b1: 2 });
  });

  it('B4 : la localisation d’une desc qui porte la légende commence sur la table, jamais sur la légende', () => {
    const a = adresse(lieu(), 2, 3);
    const al = aligne(rendu(lieu(), 2, 3), a);
    expect(a[al.couvertes!.premiere.unite].habillage).toBeFalsy();
    expect(al.couvertes!.premiere.coupe).toBe(0);
  });

  it('5d : piège — LDB `evolution-de-carriere#1` b3, tout en gras, n’est la légende d’aucune table : contenu', () => {
    const { s } = section(livre('LDB'), 'evolution-de-carriere', 1);
    expect(s.blocks[3].md).toMatch(/^\*\*[^*]+\*\*$/);
    expect(parseTable(s.blocks[4].md)).toBeNull();
    expect(unitesDuBloc(s, 3).map((u) => Boolean(u.habillage))).toEqual([false]);
  });
});

describe('6, 7, 10. aucune unité de TEXTE n’est ignorable', () => {
  it('6 : F3, un titre inventé par la desc : rien ; judge ECHEC, l’orpheline est le titre', () => {
    const lieu = section(livre('LDB'), 'version-originale', 1);
    const forge = `# Titre invente par la desc${NL}${NL}${rendu(lieu, 0, 0)}`;
    expect(aligner(unitesDuTexte(forge), adresse(lieu, 0, 0))).toBeNull();
    expect(judge({ source: { book: livre('LDB') }, desc: forge })).toEqual({ verdict: 'ECHEC', reason: 'introuvable: « titre invente par la desc »' });
  });

  it('7 : F4, une bannière inventée par la desc devant une table qui n’en porte pas : rien ; judge ECHEC', () => {
    const lieu = section(livre('LDB'), 'tableau-des-races-aleatoires', 1, '04');
    expect(unitesDuBloc(lieu.s, 0).some((u) => u.habillage)).toBe(false);
    const forge = `| CETTE LIGNE EST INVENTEE PAR LA DESC |  |${NL}${rendu(lieu, 0, 0)}`;
    expect(aligner(unitesDuTexte(forge), adresse(lieu, 0, 0))).toBeNull();
    expect(judge({ source: { book: livre('LDB') }, desc: forge })).toEqual({ verdict: 'ECHEC', reason: 'introuvable: « |cette ligne est inventee par la desc|| »' });
  });

  it('10 : le bloc et une phrase que le livre n’imprime pas : rien', () => {
    const lieu = section(livre('LDB'), 'tableau-des-races-aleatoires', 1, '04');
    expect(aligner(unitesDuTexte(`${rendu(lieu, 0, 0)}${NL}${NL}Une phrase que le livre n imprime pas.`), adresse(lieu, 0, 0))).toBeNull();
  });
});

describe('8, 8b. un rendu ré-adressé', () => {
  const A = () => section(livre('PDT'), 'mal-dans-ta-peau', 1, '11');
  const B = () => section(livre('PDT'), 'joachim-hoflich-maitre-du-barreau-or-1', 1, '10');

  it('8 : le rendu de PDT 11 `mal-dans-ta-peau#1` b2 contre PDT 10 b0 : rien', () => {
    expect(aligner(unitesDuTexte(rendu(A(), 2, 2)), adresse(B(), 0, 0))).toBeNull();
  });

  it('8b : le sens inverse s’aligne en sautant la bannière de PDT 11 b2 (2 unités touchées)', () => {
    const al = aligne(rendu(B(), 0, 0), adresse(A(), 2, 2));
    expect(al.ajoute.map(nom)).toEqual(['ligne@2.0(hab):entiere']);
    expect(touchees(al, adresse(A(), 2, 2))).toBe(2);
  });
});

describe('9. `regles:surincantation-des-sorts-d-augure` : la table sans sa dernière rangée', () => {
  it('s’aligne dans son bloc, la dernière ligne ajoutée entière (8 unités touchées)', () => {
    const lieu = section(livre('VDM'), 'table-de-surincantation-des-sorts-d-augure', 1, '03');
    const desc = rendu(lieu, 0, 0).split(NL).slice(0, -1).join(NL);
    const al = aligne(desc, adresse(lieu, 0, 0));
    expect(al.ajoute.map(nom)).toEqual(['ligne@0.9:entiere']);
    expect(touchees(al, adresse(lieu, 0, 0))).toBe(8);
    expect(judge({ source: { book: livre('VDM') }, desc })).toEqual({ verdict: 'ECHEC', reason: 'sous-bloc (desc = fragment d\'un bloc)' });
  });
});

describe('D5. préférence : le témoin est l’alignement qui touche le plus d’unités, puis le plus tôt', () => {
  it('une occurrence plus tardive qui touche deux unités l’emporte sur la première, qui n’en touche qu’une', () => {
    const a = unitesDuTexte('Une beta gamma ici\n\nPuis beta\n\ngamma enfin');
    const al = aligne('beta gamma', a);
    expect(al.couvertes).toEqual({ premiere: { unite: 1, coupe: 5 }, derniere: { unite: 2, coupe: 5 } });
    expect(al.ajoute.map(nom)).toEqual(['paragraphe@0:entiere', 'paragraphe@1:gauche', 'paragraphe@2:droite']);
  });

  it('à étendue égale, la plus tôt', () => {
    expect(aligne('beta', unitesDuTexte('alpha beta\n\nbeta')).couvertes?.premiere).toEqual({ unite: 0, coupe: 6 });
  });
});

describe('11, 12. forges GÉNÉRÉES sur le corpus', () => {
  /** Chaque bloc-table de chaque livre extrait, avec sa lecture. */
  const blocsTables = (BOOKS as [string, string][]).flatMap(([abbr]) => (chapitresDe(livre(abbr)) as string[]).flatMap((ch) => {
    const c = lireChapitre(livre(abbr), ch) as ChapitreParse | null;
    return (c?.sections ?? []).flatMap((s) => s.blocks.flatMap((b, rang) => {
      const lue = parseTable(b.md);
      return lue ? [{ ou: `${abbr} ${ch} ${s.slug}#${s.occ} b${rang}`, s, rang, md: b.md, titre: lue.titre }] : [];
    }));
  }));

  it('11 : `Fs` — chaque bloc-table, séparatrices ôtées, s’aligne à l’égalité sur son bloc', () => {
    const fs = blocsTables.filter((t) => t.md.split(NL).some(estSeparateur));
    expect(fs.length).toBeGreaterThan(0);
    const rates = fs.filter((t) => {
      const forge = t.md.split(NL).filter((l) => !estSeparateur(l)).join(NL);
      return aligner(unitesDuTexte(forge), unitesDuBloc(t.s, t.rang))?.ajoute.length !== 0;
    }).map((t) => t.ou);
    expect(rates).toEqual([]);
  });

  it('12 : `Fb` — chaque bannière absorbée ôtée : le bloc s’aligne, la bannière seule ajoutée', () => {
    const fb = blocsTables.filter((t) => t.titre != null);
    expect(fb.length).toBeGreaterThan(0);
    const rates = fb.filter((t) => {
      const lignes = t.md.split(NL);
      const forge = lignes.filter((_, i) => i !== lignes.findIndex((l) => /^\s*\|/.test(l))).join(NL);
      const al = aligner(unitesDuTexte(forge), unitesDuBloc(t.s, t.rang));
      return !al || al.ajoute.length !== 1 || !al.ajoute[0].habillage || al.ajoute[0].cote !== 'entiere';
    }).map((t) => t.ou);
    expect(rates).toEqual([]);
  });
});

describe('B3. l’orpheline de `judge` est définie par la relation', () => {
  const lieu = () => section(livre('LDB'), 'version-originale', 1);

  it('la première unité de la desc qui ne s’aligne dans AUCUN bloc du livre — une partie stricte de bloc n’en est pas une', () => {
    const partie = rendu(lieu(), 0, 0).slice(0, 60);
    const desc = `${partie}${NL}${NL}Ce paragraphe zqxw ne figure dans aucun livre du dépôt.`;
    expect(judge({ source: { book: livre('LDB') }, desc })).toEqual({ verdict: 'ECHEC', reason: 'introuvable: « ce paragraphe zqxw ne figure dans aucun livre du dépôt. »' });
  });

  it('sans orpheline, la raison est NOMMÉE', () => {
    const autre = section(livre('LDB'), 'tableau-des-races-aleatoires', 1, '04');
    const desc = `${rendu(lieu(), 0, 0)}${NL}${NL}${rendu(autre, 0, 0)}`;
    expect(judge({ source: { book: livre('LDB') }, desc })).toEqual({ verdict: 'ECHEC', reason: PRESENTE_AU_LIVRE });
  });
});
