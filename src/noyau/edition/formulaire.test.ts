/**
 * Le formulaire tiré du schéma (#3606) : la description d'une zone d'effet par `inferFields` (son Test de traversée en
 * objet, ses choix, sa référence de catalogue, ses nombres bornés ; ses listes d'ops en JSON), la valeur neuve d'un
 * nœud, et le geste `valeur` de la session, qui écrit, retire (un conteneur vidé part avec son dernier champ), refuse ce
 * que le formulaire n'offre pas, et entre dans l'historique.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptyScene, type Scene } from '../monde/scene';
import { addEffectZone, avecLaValeur } from '../sceneEdit';
import { formulaireDeZone } from '../sceneEditLecture';
import { valeurNeuveDe } from '../valeursNeuves';
import { champsDeclares, choixDuNoeud, inferFields, type FieldDesc } from '../codex/editFields';
import { editer, ouvrirLEdition, sceneEditee, type GesteDEdition, type SessionDEdition } from './session';
import { flowTestSchema } from '../../data/schemas/grammaire/mecanique';
import { idDe, idsDe, idsDeLaSousListe, refOuSpec } from '../../data/schemas/grammaire/ref';
import { CIBLE_D_APPARTENANCE } from '../../data/schemas/grammaire/sousListes';
import { DIFFICULTY_LABELS } from '../../engine/types';
import { choixDeLaFeuilleDId } from '../../data';

type Zone = NonNullable<Scene['effectZones']>[number];

/** Une zone d'effet neuve, ses champs `champs` posés. */
const zone = (champs: Partial<Zone> = {}): Zone => ({ ...addEffectZone(emptyScene('s', 4, 4), { x: 0, y: 0, w: 2, h: 2 }).scene.effectZones![0], ...champs });

/** Le champ au chemin `chemin` de la donnée `donnee`, décrit comme l'hôte le descend : `inferFields` sur la valeur de
 *  chaque objet traversé, au nœud de son champ. */
function champ(champs: readonly FieldDesc[], donnee: Record<string, unknown>, cle: string, ...reste: string[]): FieldDesc {
  const trouve = champs.find((c) => c.key === cle);
  if (!trouve) throw new Error(`aucun champ ${cle}`);
  if (!reste.length) return trouve;
  const sous = donnee[cle] as Record<string, unknown>;
  return champ(inferFields([sous], { noeud: trouve.noeud, niveau: 'profondeur' }), sous, ...(reste as [string, ...string[]]));
}

describe('la description du formulaire d’une zone d’effet', () => {
  it('vient d’`inferFields` sur son schéma : son Test de traversée, ses effets à la traversée et à chaque Round', () => {
    const z = zone();
    const champs = formulaireDeZone(z);
    expect(champs.map((c) => [c.key, c.label, c.kind, c.nullable])).toEqual([
      ['crossTest', 'Test de traversée', 'object', true],
      ['onCross', 'à la traversée', 'json', true],
      ['perRound', 'par Round', 'json', true],
    ]);
    expect(valeurNeuveDe(champs[0].noeud), 'absent, le Test s’ajoute vide').toEqual({});
  });

  it('décrit le Test présent : la référence de Compétence au catalogue, la caractéristique et la difficulté au choix, les nombres bornés, le reste en JSON', () => {
    const z = zone({ crossTest: { skill: { id: 'athletisme' as never }, characteristic: 'force', requireSL: 2 } });
    const donnee = z as unknown as Record<string, unknown>;
    const champs = formulaireDeZone(z);
    const competence = champ(champs, donnee, 'crossTest', 'skill', 'id');
    expect(competence).toMatchObject({ nullable: false });
    expect(choixDuNoeud(competence.noeud)).toEqual(choixDeLaFeuilleDId({ type: 'skill' }).map((e) => ({ valeur: e.id, libelle: e.label })));
    expect(champ(champs, donnee, 'crossTest', 'skill', 'spec')).toMatchObject({ kind: 'text', nullable: true });
    expect(choixDuNoeud(champ(champs, donnee, 'crossTest', 'characteristic').noeud)?.map((o) => o.valeur)).toContain('force');
    expect(choixDuNoeud(champ(champs, donnee, 'crossTest', 'difficulty').noeud)).toEqual(Object.entries(DIFFICULTY_LABELS).map(([valeur, libelle]) => ({ valeur, libelle })));
    expect(choixDuNoeud(champ(champs, donnee, 'crossTest', 'begging').noeud)).toEqual([{ valeur: false, libelle: 'Non' }, { valeur: true, libelle: 'Oui' }]);
    expect(champ(champs, donnee, 'crossTest', 'requireSL')).toMatchObject({ kind: 'number', bornes: { entier: false, min: null, max: null } });
    const opposition = champ(champs, donnee, 'crossTest', 'opposed');
    expect(champsDeclares(opposition.noeud), 'un objet absent s’ajoute').toBeDefined();
    expect(valeurNeuveDe(opposition.noeud)).toEqual({ attacker: 'capacite-de-combat' });
    for (const repli of ['stake', 'gate', 'vsGroups', 'difficultyBy']) {
      const f = champ(champs, donnee, 'crossTest', repli);
      expect([choixDuNoeud(f.noeud), champsDeclares(f.noeud), f.kind === 'number' || f.kind === 'text'], repli).toEqual([undefined, undefined, false]);
    }
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
