/**
 * Le formulaire tiré du schéma (#3606) : la description d'une zone d'effet (son Test de traversée en objets, choix,
 * référence de catalogue, nombres et repli JSON ; ses listes d'ops en JSON), la valeur neuve d'un nœud, et le geste
 * `valeur` de la session, qui écrit, retire (un conteneur vidé part avec son dernier champ), refuse ce que le formulaire
 * n'offre pas, et entre dans l'historique.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptyScene, type Scene } from '../monde/scene';
import { addEffectZone } from '../sceneEdit';
import { editer, ouvrirLEdition, sceneEditee, type GesteDEdition, type SessionDEdition } from './session';
import { avecLaValeur, formulaireDeZone, valeurNeuveDe, type ChampDeFormulaire } from './formulaire';
import { flowTestSchema } from '../../data/schemas/grammaire/mecanique';
import { idDe, idsDe, idsDeLaSousListe, refOuSpec } from '../../data/schemas/grammaire/ref';
import { CIBLE_D_APPARTENANCE } from '../../data/schemas/grammaire/sousListes';
import { DIFFICULTY_LABELS } from '../../engine/types';
import { choixDeLaFeuilleDId } from '../../data';

type Zone = NonNullable<Scene['effectZones']>[number];

/** Une zone d'effet neuve, ses champs `champs` posés. */
const zone = (champs: Partial<Zone> = {}): Zone => ({ ...addEffectZone(emptyScene('s', 4, 4), { x: 0, y: 0, w: 2, h: 2 }).scene.effectZones![0], ...champs });

/** Le champ au chemin `chemin` de la description `champs`. */
function champ(champs: readonly ChampDeFormulaire[], ...chemin: string[]): ChampDeFormulaire {
  const trouve = champs.find((c) => c.chemin.join('/') === chemin.slice(0, c.chemin.length).join('/'));
  if (!trouve) throw new Error(`aucun champ ${chemin.join('/')}`);
  if (trouve.chemin.length === chemin.length) return trouve;
  if (trouve.sorte !== 'objet' || !trouve.present) throw new Error(`${trouve.chemin.join('/')} n’a pas de champs`);
  return champ(trouve.champs, ...chemin);
}

describe('la description du formulaire d’une zone d’effet', () => {
  it('offre son Test de traversée, ses effets à la traversée et à chaque Round ; absent, le Test s’ajoute vide', () => {
    const champs = formulaireDeZone(zone());
    expect(champs.map((c) => [c.chemin, c.libelle, c.sorte, c.present, c.absenceAdmise])).toEqual([
      [['crossTest'], 'Test de traversée', 'objet', false, true],
      [['onCross'], 'à la traversée', 'json', false, true],
      [['perRound'], 'par Round', 'json', false, true],
    ]);
    expect(champs[0]).toMatchObject({ neuve: {} });
  });

  it('décrit le Test présent : la référence de Compétence au catalogue, la caractéristique et la difficulté au choix, les nombres, le reste en JSON', () => {
    const champs = formulaireDeZone(zone({ crossTest: { skill: { id: 'athletisme' as never }, characteristic: 'force', requireSL: 2 } }));
    const competence = champ(champs, 'crossTest', 'skill', 'id');
    expect(competence).toMatchObject({ sorte: 'choix', present: true, valeur: 'athletisme', absenceAdmise: false });
    expect(competence.sorte === 'choix' && competence.options).toEqual(choixDeLaFeuilleDId({ type: 'skill' }).map((e) => ({ valeur: e.id, libelle: e.label })));
    expect(champ(champs, 'crossTest', 'skill', 'spec')).toMatchObject({ sorte: 'texte', present: false, absenceAdmise: true });
    const caracteristique = champ(champs, 'crossTest', 'characteristic');
    expect(caracteristique).toMatchObject({ sorte: 'choix', present: true, valeur: 'force' });
    expect(caracteristique.sorte === 'choix' && caracteristique.options.map((o) => o.valeur)).toContain('force');
    const difficulte = champ(champs, 'crossTest', 'difficulty');
    expect(difficulte.sorte === 'choix' && difficulte.options).toEqual(Object.entries(DIFFICULTY_LABELS).map(([valeur, libelle]) => ({ valeur, libelle })));
    expect(champ(champs, 'crossTest', 'begging')).toMatchObject({ sorte: 'choix', options: [{ valeur: false, libelle: 'Non' }, { valeur: true, libelle: 'Oui' }] });
    expect(champ(champs, 'crossTest', 'requireSL')).toMatchObject({ sorte: 'nombre', entier: false, min: null, max: null, present: true, valeur: 2 });
    expect(champ(champs, 'crossTest', 'opposed')).toMatchObject({ sorte: 'objet', present: false, neuve: { attacker: 'capacite-de-combat' } });
    for (const repli of ['stake', 'gate', 'vsGroups', 'difficultyBy']) expect(champ(champs, 'crossTest', repli).sorte, repli).toBe('json');
  });

  it('une référence se choisit dans la sous-liste que sa feuille déclare', () => {
    const schema = z.strictObject({ groupe: idDe('groupe', CIBLE_D_APPARTENANCE) });
    const hors = [...idsDe('groupe')].find((id) => !idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE).includes(id))!;
    expect(valeurNeuveDe(schema)).toEqual({ groupe: idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE)[0] });
    expect(avecLaValeur(schema, { groupe: 'x' }, ['groupe'], hors), 'hors de la sous-liste').toBeUndefined();
  });
});

describe('la valeur neuve d’un nœud', () => {
  it('d’un objet, ses seuls champs requis : la première option d’un choix, 0 ou la borne basse d’un nombre, un texte vide, faux, une liste vide', () => {
    const schema = z.strictObject({
      n: z.number(), borne: z.number().int().min(3), t: z.string(), b: z.boolean(), l: z.array(z.string()), e: z.enum(['a', 'b']), o: z.string().optional(),
    });
    expect(valeurNeuveDe(schema)).toEqual({ n: 0, borne: 3, t: '', b: false, l: [], e: 'a' });
    expect(valeurNeuveDe(flowTestSchema), 'un Test n’exige aucun champ').toEqual({});
    expect(valeurNeuveDe(refOuSpec('skill'))).toEqual({ id: choixDeLaFeuilleDId({ type: 'skill' })[0].id });
  });
});

describe('l’écriture bornée par le formulaire', () => {
  const schema = z.strictObject({ a: z.strictObject({ id: z.string(), n: z.number().optional(), b: z.strictObject({ m: z.number().optional() }).optional() }).optional() });

  it('refuse une clé `id` d’identité, qui se change par son geste dédié ; une référence `idDe` s’écrit', () => {
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 'id'], 'y')).toBeUndefined();
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 'n'], 2)).toEqual({ a: { id: 'x', n: 2 } });
  });

  it('un conteneur vidé par le retrait de son dernier champ part avec lui, de proche en proche, tant que son absence est admise', () => {
    expect(avecLaValeur(schema, { a: { id: 'x', b: { m: 1 } } }, ['a', 'b', 'm'], undefined), '`a` garde son `id` requis').toEqual({ a: { id: 'x' } });
    const sansId = z.strictObject({ a: z.strictObject({ b: z.strictObject({ m: z.number().optional() }).optional() }).optional() });
    expect(avecLaValeur(sansId, { a: { b: { m: 1 } } }, ['a', 'b', 'm'], undefined)).toEqual({});
    expect(avecLaValeur(sansId, { a: { b: { m: 1 } } }, ['a', 'b'], {}), 'poser sa valeur neuve ne retire rien').toEqual({ a: { b: {} } });
  });

  it('refuse un pas sous un objet absent, une clé non déclarée, un rang hors d’une liste, le retrait d’un champ requis', () => {
    expect(avecLaValeur(schema, {}, ['a', 'n'], 1)).toBeUndefined();
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 'z'], 1)).toBeUndefined();
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 0], 1)).toBeUndefined();
    expect(avecLaValeur(schema, { a: { id: 'x' } }, [], 1)).toBeUndefined();
    expect(avecLaValeur(z.strictObject({ r: z.number() }), { r: 1 }, ['r'], undefined), 'un champ requis ne se retire pas').toBeUndefined();
  });
});

describe('le geste `valeur` de la session', () => {
  const ouverte = (): { s: SessionDEdition; id: string } => {
    const { scene } = addEffectZone(emptyScene('s', 4, 4), { x: 0, y: 0, w: 2, h: 2 });
    return { s: ouvrirLEdition({ scenes: [scene] } as unknown as Parameters<typeof ouvrirLEdition>[0], false), id: scene.effectZones![0].id };
  };
  const { s: depart, id } = ouverte();
  const porteur = { sorte: 'zone' as const, id };
  const jouer = (s: SessionDEdition, chemin: (string | number)[], ...valeur: unknown[]): SessionDEdition =>
    editer(s, { geste: 'valeur', porteur, chemin, ...(valeur.length ? { valeur: valeur[0] } : {}) } as GesteDEdition);
  const laZone = (s: SessionDEdition) => sceneEditee(s).effectZones![0];

  it('ajoute le Test vide, y écrit chaque champ de sa sorte, retire le dernier avec le Test ; annuler et rétablir le suivent', () => {
    const ajoute = jouer(depart, ['crossTest'], {});
    expect(laZone(ajoute).crossTest).toEqual({});
    expect(jouer(ajoute, ['crossTest', 'characteristic']), 'retirer un champ absent ne vide pas le Test ajouté').toBe(ajoute);
    const ecrit = jouer(jouer(jouer(ajoute, ['crossTest', 'characteristic'], 'force'), ['crossTest', 'difficulty'], 'difficile'), ['crossTest', 'requireSL'], 1.5);
    expect(laZone(ecrit).crossTest).toEqual({ characteristic: 'force', difficulty: 'difficile', requireSL: 1.5 });
    const ops = [{ op: 'corruption', amount: 1 }];
    expect(laZone(jouer(ecrit, ['perRound'], ops)).perRound).toEqual(ops);
    expect(jouer(ecrit, ['crossTest', 'characteristic'], 'force'), 'la même valeur n’ajoute aucun cran').toBe(ecrit);

    const vide = jouer(jouer(jouer(ecrit, ['crossTest', 'requireSL']), ['crossTest', 'difficulty']), ['crossTest', 'characteristic']);
    expect(laZone(vide).crossTest, 'le Test vidé quitte la zone').toBeUndefined();
    const annule = editer(vide, { geste: 'annuler' });
    expect(laZone(annule).crossTest).toEqual({ characteristic: 'force' });
    expect(laZone(editer(annule, { geste: 'retablir' })).crossTest).toBeUndefined();
  });

  it('refuse une valeur hors de la sorte de son champ, un champ que le formulaire n’offre pas, une zone absente', () => {
    const ajoute = jouer(depart, ['crossTest'], {});
    for (const [chemin, valeur] of [
      [['crossTest', 'characteristic'], 'vigueur'],
      [['crossTest', 'requireSL'], 'deux'],
      [['crossTest', 'requireSL'], Number.POSITIVE_INFINITY],
      [['crossTest', 'label'], 3],
      [['crossTest', 'easierIf'], { steps: 1 }],
      [['crossTest', 'skill', 'id'], 'athletisme'],
      [['perRound'], [{ op: 'pas-une-op' }]],
      [['label'], 'Autre'],
      [['id'], 'autre'],
    ] as [(string | number)[], unknown][]) expect(jouer(ajoute, chemin, valeur), `${chemin.join('/')} ← ${String(valeur)}`).toBe(ajoute);
    expect(editer(ajoute, { geste: 'valeur', porteur: { sorte: 'zone', id: 'nulle-part' }, chemin: ['crossTest', 'characteristic'], valeur: 'force' })).toBe(ajoute);
    expect(laZone(jouer(jouer(ajoute, ['crossTest', 'skill'], valeurNeuveDe(refOuSpec('skill'))), ['crossTest', 'skill', 'id'], 'athletisme')).crossTest, 'la référence de Compétence se choisit').toEqual({ skill: { id: 'athletisme' } });
  });
});
