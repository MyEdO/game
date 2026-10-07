/**
 * `adapteDe` (#2001, `champAdapteDe` + `refineAdapteDe`, `grammaire/prose.ts`) — sur chaque SITE, le
 * verbatim seul et l'adapté seul parsent ; les deux ensemble sont refusés par UNE faute, au chemin
 * `adapteDe`, dite en français (le site se lit au chemin). Le document du narratif reste verbatim : `adapteDe` y est une clé inconnue.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { documentNarratifSchema, indiceStadeSchema, ouvertureSchema, presetPnjSchema } from './narratif';
import { dialogueNodeSchema } from './scene';
import { journalSchema } from './effets';
import { projetSchema } from './projet';
import { coDescendre, type PointDeDonnee } from '../grammaire/descente';
import { sourceHeritee } from '../grammaire/prose';
import { CURRENT_PROJECT_SCHEMA } from '../../../state/worldMap';
import { emptyScene } from '../../../state/scene';
import { emptyNarratif } from '../../../state/campaignNarratif';

const ADAPTE = { book: 'ennemi-dans-l-ombre', page: 14 };
const SOURCE = { book: 'ennemi-dans-l-ombre', page: 12 };
const DESC_REF = {
  book: 'ennemi-dans-l-ombre',
  ch: '01',
  parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }],
};

/** Un projet VALIDE minimal (même forme que `projet()` de `state/forme-vivante.test.ts`). */
const projetValide = () => ({
  type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj', label: 'Projet', versionContenu: 1,
  maison: 'fixture de test', narratif: emptyNarratif(), scenes: [{ ...emptyScene(4, 4), id: 's1', label: 'Salle' }],
});

interface Site {
  readonly nom: string;
  readonly schema: z.ZodType;
  /** Le nœud minimal du site, sans provenance. */
  readonly nu: Record<string, unknown>;
  /** Le porteur du verbatim sur ce site. */
  readonly verbatim: 'source' | 'descRef';
  readonly valeurVerbatim: unknown;
}

const SITES: readonly Site[] = [
  { nom: 'narratif.indices[].stades[]', schema: indiceStadeSchema, nu: { id: 's1', prose: 'Une trace.' }, verbatim: 'source', valeurVerbatim: SOURCE },
  { nom: 'narratif.presetsPnj[]', schema: presetPnjSchema, nu: { id: 'pnj', base: 'humain' }, verbatim: 'source', valeurVerbatim: SOURCE },
  { nom: 'narratif.ouverture', schema: ouvertureSchema, nu: { titre: 'Titre', pitch: 'Un pitch.' }, verbatim: 'source', valeurVerbatim: SOURCE },
  { nom: 'dialogues[].nodes[]', schema: dialogueNodeSchema, nu: { id: 'n1', choices: [] }, verbatim: 'descRef', valeurVerbatim: DESC_REF },
  { nom: 'journal', schema: journalSchema, nu: { type: 'journal' }, verbatim: 'descRef', valeurVerbatim: DESC_REF },
];

/** La prose inline d'un site qui l'exige (nœud, journal) ; rien ailleurs (le nœud nu la porte déjà). */
const prose = (s: Site): Record<string, unknown> => (s.verbatim === 'descRef' ? { desc: 'Une réplique maison.' } : {});

describe.each(SITES)('adapteDe — site $nom', (site) => {
  it('le verbatim SEUL parse', () => {
    expect(site.schema.safeParse({ ...site.nu, [site.verbatim]: site.valeurVerbatim }).error).toBeUndefined();
  });

  it('l’adapté SEUL parse', () => {
    expect(site.schema.safeParse({ ...site.nu, ...prose(site), adapteDe: ADAPTE }).error).toBeUndefined();
  });

  it('ni l’un ni l’autre parse : la provenance ne s’exige pas au parse', () => {
    expect(site.schema.safeParse({ ...site.nu, ...prose(site) }).error).toBeUndefined();
  });

  it('les DEUX ensemble sont refusés : UNE faute, au chemin `adapteDe`', () => {
    const r = site.schema.safeParse({ ...site.nu, [site.verbatim]: site.valeurVerbatim, adapteDe: ADAPTE });
    expect(r.error?.issues.map((i) => ({ path: i.path, message: i.message }))).toEqual([
      { path: ['adapteDe'], message: 'texte à la fois copié et adapté d’un passage : garde l’un ou l’autre.' },
    ]);
  });
});

describe('adapteDe — la prose d’un nœud de dialogue et d’un journal reste exigée', () => {
  it.each([
    ['dialogues[].nodes[]', dialogueNodeSchema, { id: 'n1', choices: [], adapteDe: ADAPTE }],
    ['journal', journalSchema, { type: 'journal', adapteDe: ADAPTE }],
  ] as const)('%s : `adapteDe` sans texte est refusé (prose obligatoire)', (_site, schema, valeur) => {
    const r = schema.safeParse(valeur);
    expect(r.error?.issues.map((i) => i.path)).toEqual([['desc']]);
  });
});

describe('preset : `adapteDe` et profil ADRESSÉ s’excluent', () => {
  it('profil adressé + `adapteDe` : refusé au chemin `adapteDe` ; sans adresse, l’adapté parse', () => {
    const r = presetPnjSchema.safeParse({ id: 'pnj', base: 'humain', adapteDe: ADAPTE, profil: { descRef: DESC_REF } });
    expect(r.error?.issues.map((i) => ({ path: i.path, message: i.message }))).toEqual([
      { path: ['adapteDe'], message: 'texte adapté, alors que la description du profil est la copie adressée du livre.' },
    ]);
    expect(presetPnjSchema.safeParse({ id: 'pnj', base: 'humain', adapteDe: ADAPTE, profil: { desc: 'Un cocher bourru.' } }).error).toBeUndefined();
    expect(presetPnjSchema.safeParse({ id: 'pnj', base: 'humain', source: SOURCE, profil: { descRef: DESC_REF } }).error).toBeUndefined();
  });
});

describe('`sourceHeritee` — sur un projet VALIDE, `adapteDe` coupe l’héritage de la racine', () => {
  it('le profil d’un preset nu hérite de la `source` du projet ; celui d’un preset adapté, de rien', () => {
    const base = projetValide();
    const projet = {
      ...base,
      source: SOURCE,
      narratif: { ...base.narratif, presetsPnj: [{ id: 'nu', base: 'humain', profil: { label: 'A' } }, { id: 'adapte', base: 'humain', adapteDe: ADAPTE, profil: { label: 'B' } }] },
    };
    const v = projetSchema.safeParse(projet);
    expect(v.error?.issues).toBeUndefined();
    const [nu, adapte] = projet.narratif.presetsPnj.map((p) => p.profil);
    const heritees = new Map<unknown, unknown>();
    coDescendre(projetSchema, projet, (p: PointDeDonnee) => {
      if (p.valeur === nu || p.valeur === adapte) heritees.set(p.valeur, sourceHeritee(p));
      return undefined;
    });
    expect(heritees.get(nu)).toEqual(SOURCE);
    expect(heritees.has(adapte)).toBe(true);
    expect(heritees.get(adapte)).toBeUndefined();
  });
});

describe('document du narratif — verbatim seul', () => {
  it('`adapteDe` y est une clé inconnue', () => {
    const r = documentNarratifSchema.safeParse({ id: 'doc', titre: 'Affiche', prose: 'VOYAGEURS', adapteDe: ADAPTE });
    expect(r.error?.issues.map((i) => ({ code: i.code, keys: (i as { keys?: string[] }).keys }))).toEqual([{ code: 'unrecognized_keys', keys: ['adapteDe'] }]);
  });
});
