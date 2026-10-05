// Banc de l'index imprimé (#1887, lot 7) : ses règles sur des fixtures, et sur le CRB RÉEL
// (`121 - Index.md`) ses INVARIANTS et des cas nommés ; les comptes s'impriment, jamais assertés.
import { describe, it, expect } from 'vitest';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { chapitresParses } from '../../../scripts/source/lecteur-fs.mjs';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { chapterFile, readText } from '../../../scripts/raw/_lib.mjs';
import { lireIndexImprime, type EntreeDIndexImprime } from './index-imprime.ts';
import { indexerLivre, resoudreRenvoi } from './renvoi.ts';

const CRB = 'core-rulebook-5e';
const md: string = readText(chapterFile('CRB', 121).path);
const entrees = lireIndexImprime(md, 'VO');
const livre = indexerLivre(CRB, 'VO', chapitresParses(CRB));

/** L'entrée unique de ce terme (et de ce qualificatif). */
function entree(terme: string, qualificatif?: string): EntreeDIndexImprime {
  const hits = entrees.filter((e) => e.terme === terme && e.qualificatif === qualificatif);
  expect(hits, `${terme} (${qualificatif ?? '∅'})`).toHaveLength(1);
  return hits[0];
}

/** Une page d'une entrée résolue comme un renvoi dont la clause et la phrase sont le terme. */
const resoudre = (e: EntreeDIndexImprime, page: number) =>
  resoudreRenvoi(livre, { folio: page, fin: null, debut: 0, clause: e.terme, phrase: e.terme });

const paires = entrees.flatMap((e) => e.pages.map((p): [EntreeDIndexImprime, number] => [e, p]));

describe('lireIndexImprime — règles sur fixtures', () => {
  const lire = (lignes: string[]) => lireIndexImprime(lignes.join('\n'), 'VO');

  it('une ligne d’en-tête porte des entrées ; une lettre seule est un en-tête ; un terme replié se ferme par-delà le séparateur', () => {
    expect(lire(['| A | Armour Repels the Winds |', '|---|---|', '| Ablaze (Condition) 185 | (of Magic) 237 |'])).toEqual([
      { terme: 'Ablaze', qualificatif: 'Condition', pages: [185], ligne: 3, fin: 3 },
      { terme: 'Armour Repels the Winds (of Magic)', pages: [237], ligne: 1, fin: 3 },
    ]);
  });

  it('une première cellule vide ne porte rien ; une ancre de folio est retirée ; une page collée au qualificatif est lue', () => {
    expect(lire(['<span id="page-1-0" data-folio="2"></span>| | Halfling (as NPC) 319 |', '| Witness (Miracle)229 | |'])).toEqual([
      { terme: 'Halfling (as NPC)', pages: [319], ligne: 1, fin: 1 },
      { terme: 'Witness', qualificatif: 'Miracle', pages: [229], ligne: 2, fin: 2 },
    ]);
  });

  it('qualificatif nu : « X Skill » sans parenthèses donne `{ terme: X, qualificatif: Skill }` ; une parenthèse finale qualifiante prime', () => {
    expect(lire(['| Art Skill 111 | Using the Heal Skill 170 |', '| Skill 3 | Lore (Skill) 112 |'])).toEqual([
      { terme: 'Art', qualificatif: 'Skill', pages: [111], ligne: 1, fin: 1 },
      { terme: 'Using the Heal', qualificatif: 'Skill', pages: [170], ligne: 1, fin: 1 },
      { terme: 'Skill', pages: [3], ligne: 2, fin: 2 },
      { terme: 'Lore', qualificatif: 'Skill', pages: [112], ligne: 2, fin: 2 },
    ]);
  });

  it('une langue sans motifs, ou un terme replié sans page, est une erreur', () => {
    expect(() => lireIndexImprime('| Abc 1 |', 'VF')).toThrow(/VF/);
    expect(() => lire(['| A | Beacon of |', '|---|---|', '| Abc 1 | |'])).toThrow(/Beacon of/);
  });
});

describe('lireIndexImprime — CRB `121 - Index.md`', () => {
  it('invariants : terme non vide, jamais une lettre seule, ligne ≤ fin, toute page portée par un texte du livre', () => {
    for (const e of entrees) {
      expect(e.terme.trim(), `l.${e.ligne}`).not.toBe('');
      expect(/^\p{Lu}$/u.test(e.terme), `l.${e.ligne} ${e.terme}`).toBe(false);
      expect(e.ligne, e.terme).toBeLessThanOrEqual(e.fin);
      for (const p of e.pages) expect(livre.parFolio.has(p), `${e.terme} p.${p}`).toBe(true);
    }
    const q: Record<string, number> = {};
    for (const e of entrees) q[e.qualificatif ?? '∅'] = (q[e.qualificatif ?? '∅'] ?? 0) + 1;
    console.log(`INDEX IMPRIMÉ CRB — ${entrees.length} entrées, ${entrees.filter((e) => e.fin !== e.ligne).length} replis, `
      + `${new Set(entrees.flatMap((e) => e.pages)).size} pages ; qualificatifs ${JSON.stringify(q)}`);
  });

  it('cas nommés : repli, première cellule vide, complément en minuscule, Skill nu', () => {
    expect(entree('Beacon of Righteous Virtue', 'Miracle')).toMatchObject({ pages: [226], ligne: 32, fin: 33 });
    expect(entree('Halfling (as NPC)')).toMatchObject({ pages: [319], ligne: 164 });
    expect(entree('Dwarfs (as Characters)')).toMatchObject({ pages: [28] });
    expect(entree('Art', 'Skill')).toMatchObject({ pages: [111] });
    expect(entree('Using the Heal', 'Skill')).toMatchObject({ pages: [170], ligne: 325 });
  });
});

describe('resoudreRenvoi — une entrée d’index EST un renvoi', () => {
  it('invariants : jamais `section-phrase` (phrase = clause) ; une cible ssi le niveau est prouvé', () => {
    const n: Record<string, number> = {};
    for (const [e, p] of paires) {
      const r = resoudre(e, p);
      n[r.niveau] = (n[r.niveau] ?? 0) + 1;
      expect(r.niveau, `${e.terme} p.${p}`).not.toBe('section-phrase');
      const prouve = ['table', 'section-adjacente', 'section-englobante'].includes(r.niveau);
      expect(r.cible != null, `${e.terme} p.${p} ${r.niveau}`).toBe(prouve);
    }
    console.log(`INDEX IMPRIMÉ CRB — niveaux des ${paires.length} pages d’entrée : ${JSON.stringify(n)}`);
  });

  it('section-englobante : « Stealth » (p.114, portée par 020 et 021) → Stealth (Ag) basic, grouped', () => {
    const r = resoudre(entree('Stealth', 'Skill'), 114);
    expect([r.niveau, r.candidats]).toEqual(['section-englobante', ['020 - Skills.md § Stealth (Ag) basic, grouped']]);
  });

  it('Skill nu : « Art Skill » p.111 → Art (Dex) ; « Using the Heal Skill » p.170 → Using the Heal Skill', () => {
    const art = resoudre(entree('Art', 'Skill'), 111);
    expect([art.niveau, art.cible?.parts[0].sec]).toEqual(['section-englobante', 'art-dex-basic-grouped']);
    const heal = resoudre(entree('Using the Heal', 'Skill'), 170);
    expect(heal.cible?.parts[0].sec).toBe('using-the-heal-skill');
  });
});
