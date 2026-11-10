/**
 * Le formulaire tiré du schéma (#3606) : la description d'une zone d'effet et de la condition d'entrée d'un déclencheur
 * (`formulaireDe`, `champsOfferts`), leurs unions choisies par variante nommée (`unionDuNoeud`, `variantesAChoisir`),
 * leurs listes élément par élément (`elementDuNoeud`, `champDeLElement`, `gestesDeLaListe`), la valeur neuve d'un nœud
 * et d'une op (`valeurNeuveDe`, `newOp`), et le geste `valeur` de la session, qui écrit, change de variante, ajoute,
 * retire et monte un élément de liste, retire (un conteneur vidé part avec son dernier champ), refuse ce que le
 * formulaire n'offre pas en disant pourquoi (`refusDeLaValeur`), et entre dans l'historique. Les choix d'une union
 * réunissent ceux de ses feuilles, énumérations et littéraux ; une union se lit aussi à la présence de son discriminant
 * (`optionalEntrySchema`, #3606 M1a).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { emptyScene, type Scene } from '../monde/scene';
import { addEffectZone, addTrigger, avecLaValeur, gestesDeLaListe, type Segment } from '../sceneEdit';
import { formulaireDe } from '../sceneEditLecture';
import { newOp, valeurNeuveDe, variantesAChoisir } from '../valeursNeuves';
import { champDeLElement, champsDeclares, champsOfferts, choixDuNoeud, elementDuNoeud, formeAuPoint, unionDuNoeud, varianteCourante, type FieldDesc } from '../codex/editFields';
import { editer, ouvrirLEdition, refusDeLaValeur, sceneEditee, type GesteDEdition, type SessionDEdition } from './session';
import { conditionSchema, flowTestSchema, OP_DEFS, OP_LABEL, OPS_NON_TYPEES } from '../../data/schemas/grammaire/mecanique';
import { idDe, idsDe, idsDeLaSousListe, refOuSpec } from '../../data/schemas/grammaire/ref';
import { CIBLE_D_APPARTENANCE } from '../../data/schemas/grammaire/sousListes';
import { CONDITION_TOUJOURS, recast } from '../../data/valeursNeuves';
import { DIFFICULTY_LABELS } from '../../engine/types';
import type { Condition } from '../../engine/flowCore';
import type { GameOp } from '../../engine/ops';
import { choixDeLaFeuilleDId } from '../../data';
import { especeDApparenceSchema, tenueFermeeSchema } from '../../data/schemas/grammaire/valeurs';
import { optionalEntrySchema } from '../../data/schemas/defs/creatures';

/** Aucun preset de PNJ : une zone d'effet et un déclencheur n'en lisent aucun. */
const SANS_PRESET = (): undefined => undefined;

type Zone = NonNullable<Scene['effectZones']>[number];
type Declencheur = Scene['triggers'][number];

/** Une zone d'effet neuve, ses champs `champs` posés. */
const zone = (champs: Partial<Zone> = {}): Zone => ({ ...addEffectZone(emptyScene('s', 4, 4), { x: 0, y: 0, w: 2, h: 2 }).scene.effectZones![0], ...champs });

/** Un déclencheur neuf, sa condition d'entrée `when` posée. */
const declencheur = (when?: Condition): Declencheur => ({ ...addTrigger(emptyScene('s', 4, 4), { x: 0, y: 0, w: 1, h: 1 }).scene.triggers[0], ...(when ? { when } : {}) });

/** Le champ au chemin `[cle, ...reste]` de la donnée `donnee`, décrit comme l'hôte le descend : l'élément d'une liste à
 *  son rang (`champDeLElement`), les champs d'un objet ou de la variante courante d'une union (`formeAuPoint`,
 *  `champsOfferts`). */
function champ(champs: readonly FieldDesc[], donnee: unknown, cle: Segment, ...reste: Segment[]): FieldDesc {
  const trouve = champs.find((c) => c.key === String(cle));
  if (!trouve) throw new Error(`aucun champ ${cle}`);
  if (!reste.length) return trouve;
  const sous = (donnee as Record<Segment, unknown>)[cle];
  const [suivant] = reste;
  if (typeof suivant === 'number') return champ([champDeLElement(trouve, suivant)], sous, String(suivant), ...reste.slice(1));
  const forme = formeAuPoint(trouve.noeud, sous)!;
  return champ(champsOfferts(forme.noeud, sous as Record<string, unknown>, forme.tenus), sous, ...(reste as [Segment, ...Segment[]]));
}

describe('la description du formulaire d’une zone d’effet', () => {
  it('offre son Test de traversée, ses effets à la traversée et à chaque Round, chacun une liste d’ops, et son rendu ; absent, le Test s’ajoute vide', () => {
    const champs = formulaireDe('zone', zone(), SANS_PRESET);
    expect(champs.map((c) => [c.key, c.label, c.nullable])).toEqual([['crossTest', 'Test de traversée', true], ['onCross', 'à la traversée', true], ['perRound', 'par Round', true], ['rendu', 'rendu', true]]);
    expect(valeurNeuveDe(champs[0].noeud)).toEqual({});
    for (const liste of champs.slice(1, 3)) expect(unionDuNoeud(elementDuNoeud(liste.noeud))?.discriminant, liste.key).toBe('op');
  });

  it('décrit le Test présent : la référence de Compétence au catalogue, la caractéristique et la difficulté au choix, les nombres bornés, sa garde en Condition, ses listes, son enjeu choisi par variante', () => {
    const z = zone({ crossTest: { skill: { id: 'athletisme' as never }, characteristic: 'force', requireSL: 2 } });
    const champs = formulaireDe('zone', z, SANS_PRESET);
    const competence = champ(champs, z, 'crossTest', 'skill', 'id');
    expect(competence).toMatchObject({ nullable: false });
    expect(choixDuNoeud(competence.noeud)).toEqual(choixDeLaFeuilleDId({ type: 'skill' }).map((e) => ({ valeur: e.id, libelle: e.label })));
    expect(champ(champs, z, 'crossTest', 'skill', 'spec')).toMatchObject({ kind: 'text', nullable: true });
    expect(choixDuNoeud(champ(champs, z, 'crossTest', 'characteristic').noeud)?.map((o) => o.valeur)).toContain('force');
    expect(choixDuNoeud(champ(champs, z, 'crossTest', 'difficulty').noeud)).toEqual(Object.entries(DIFFICULTY_LABELS).map(([valeur, libelle]) => ({ valeur, libelle })));
    expect(choixDuNoeud(champ(champs, z, 'crossTest', 'begging').noeud)).toEqual([{ valeur: false, libelle: 'Non' }, { valeur: true, libelle: 'Oui' }]);
    expect(champ(champs, z, 'crossTest', 'requireSL')).toMatchObject({ kind: 'number', bornes: { entier: false, min: null, max: null } });
    const opposition = champ(champs, z, 'crossTest', 'opposed');
    expect(champsDeclares(opposition.noeud), 'un objet absent s’ajoute').toBeDefined();
    expect(valeurNeuveDe(opposition.noeud)).toEqual({ attacker: 'capacite-de-combat' });
    expect(unionDuNoeud(champ(champs, z, 'crossTest', 'gate').noeud)?.discriminant).toBe('kind');
    expect(valeurNeuveDe(elementDuNoeud(champ(champs, z, 'crossTest', 'difficultyBy').noeud))).toEqual({ cond: CONDITION_TOUJOURS, difficulty: 'tresFacile' });
    const enjeu = champ(champs, z, 'crossTest', 'stake');
    expect([champsDeclares(enjeu.noeud), unionDuNoeud(enjeu.noeud)?.variantes.map((v) => v.cle), elementDuNoeud(enjeu.noeud)], 'une union sans discriminant se choisit à la clé propre de ses branches').toEqual([undefined, ['key', 'authored', 'from'], undefined]);
  });

  it('une référence se choisit dans la sous-liste que sa feuille déclare', () => {
    const schema = z.strictObject({ groupe: idDe('groupe', CIBLE_D_APPARTENANCE) });
    const hors = [...idsDe('groupe')].find((id) => !idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE).includes(id))!;
    expect(valeurNeuveDe(schema)).toEqual({ groupe: idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE)[0] });
    expect(avecLaValeur(schema, { groupe: 'x' }, ['groupe'], hors), 'hors de la sous-liste').toEqual({ ok: false, refus: 'horsSorte' });
  });

  it('une op se choisit parmi toutes, chacune nommée, neuve par `newOp` ; typée, elle se décrit champ par champ, son `op` tenu par le choix', () => {
    const z = zone({ onCross: [{ op: 'charMod', characteristic: 'force', mod: -10 }] as never });
    const champs = formulaireDe('zone', z, SANS_PRESET);
    const op = champ(champs, z, 'onCross', 0);
    expect(op).toMatchObject({ key: '0', label: 'à la traversée 1', nullable: false });
    const variantes = variantesAChoisir(op.noeud, z.onCross![0])!;
    expect(variantes.map((v) => v.cle).sort()).toEqual([...Object.keys(OP_DEFS), ...OPS_NON_TYPEES].sort());
    for (const v of variantes) expect(v.libelle, v.cle).toBe(OP_LABEL[v.cle as GameOp['op']]);
    expect(variantes.find((v) => v.cle === 'corruption')!.valeur).toEqual(newOp('corruption'));
    expect(variantes.find((v) => v.courante), 'la courante pose sa valeur').toMatchObject({ cle: 'charMod', valeur: z.onCross![0] });
    expect(formeAuPoint(op.noeud, z.onCross![0])?.tenus).toEqual(['op']);
    expect(choixDuNoeud(champ(champs, z, 'onCross', 0, 'characteristic').noeud)?.map((o) => o.valeur)).toContain('force');
    expect(champ(champs, z, 'onCross', 0, 'mod')).toMatchObject({ kind: 'number' });
  });

  it('une op de `OPS_NON_TYPEES` choisie n’a pas de forme déclarée : sa saisie reste en JSON', () => {
    expect(OPS_NON_TYPEES).toContain('wounds');
    const valeur = { op: 'wounds', amount: 5 };
    const noeud = elementDuNoeud(formulaireDe('zone', zone({ onCross: [valeur] as never }), SANS_PRESET)[1].noeud);
    const u = unionDuNoeud(noeud)!;
    expect(varianteCourante(u, valeur)).toMatchObject({ cle: 'wounds', noeud: undefined });
    expect(formeAuPoint(noeud, valeur)).toBeUndefined();
  });
});

describe('`newOp`', () => {
  it('sans fabrique, une op typée prend la valeur neuve de son payload, ses références vides, une op non typée son seul nom ; une op inconnue lève', () => {
    expect(newOp('incomingAttackMod')).toEqual(valeurNeuveDe(OP_DEFS.incomingAttackMod));
    expect(newOp('contractDisease'), 'aucune Maladie élue à la place de l’auteur').toEqual({ op: 'contractDisease', disease: '' });
    expect(newOp('incomingAttackMod')).toMatchObject({ op: 'incomingAttackMod' });
    expect(newOp('intoxicate')).toEqual({ op: 'intoxicate' });
    expect(() => newOp('pas-une-op')).toThrow(/pas-une-op/);
  });
});

describe('la description de la condition d’entrée d’un déclencheur', () => {
  it('une Condition `all` qui porte un `not` : chaque union se choisit par variante nommée, la liste élément par élément', () => {
    const when: Condition = { kind: 'all', of: [{ kind: 'flag', expr: 'porte' }, { kind: 'not', of: { kind: 'foeInLoS' } }] };
    const d = declencheur(when);
    const champs = formulaireDe('declencheur', d, SANS_PRESET);
    expect(champs.map((c) => [c.key, c.nullable])).toEqual([['when', true]]);
    const variantes = variantesAChoisir(champs[0].noeud, when)!;
    expect(variantes).toHaveLength(35);
    expect(new Set(variantes.map((v) => v.libelle)).size, 'chacune nommée par son schéma, d’un nom propre').toBe(35);
    expect(['all', 'any', 'not'].map((k) => variantes.find((v) => v.cle === k)?.libelle)).toEqual(['TOUS (ET)', 'AU MOINS UN (OU)', 'NON']);
    expect(variantes.find((v) => v.cle === 'not')!.valeur, 'NON enveloppe la courante (`recast`)').toEqual({ kind: 'not', of: when });
    expect(variantes.find((v) => v.courante)?.cle).toBe('all');
    const contenu = champ(champs, d, 'when', 'of');
    expect(valeurNeuveDe(elementDuNoeud(contenu.noeud))).toEqual(CONDITION_TOUJOURS);
    expect([0, 1].map((rang) => champDeLElement(contenu, rang).label)).toEqual([`${contenu.label} 1`, `${contenu.label} 2`]);
    expect(champ(champs, d, 'when', 'of', 0, 'expr')).toMatchObject({ kind: 'text' });
    const non = champ(champs, d, 'when', 'of', 1, 'of');
    expect(variantesAChoisir(non.noeud, { kind: 'foeInLoS' })!.find((v) => v.courante)?.cle).toBe('foeInLoS');
  });

  it('une variante qui est elle-même une union se choisit au même chemin, nommée par l’énumération de son discriminant ; ni `kind` ni `what` ne s’écrivent en champ', () => {
    const has = { kind: 'has', who: 'target', what: 'group', value: 'x' } as Condition;
    const noeud = formulaireDe('declencheur', declencheur(has), SANS_PRESET)[0].noeud;
    const interne = varianteCourante(unionDuNoeud(noeud)!, has)!.noeud;
    const u = unionDuNoeud(interne)!;
    expect(u.discriminant).toBe('what');
    expect(u.variantes.map((v) => v.cle)).toEqual(['group', 'talent', 'trait', 'psych', 'immunity']);
    expect(u.variantes.every((v) => v.libelle.length > 0)).toBe(true);
    const forme = formeAuPoint(noeud, has)!;
    expect(forme.tenus).toEqual(['kind', 'what']);
    expect(champsOfferts(forme.noeud, has as Record<string, unknown>, forme.tenus).map((c) => c.key)).toEqual(['who', 'value']);
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
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 'id'], 'y')).toEqual({ ok: false, refus: 'nonOffert' });
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 'n'], 2)).toEqual({ ok: true, valeur: { a: { id: 'x', n: 2 } } });
  });

  it('un conteneur vidé par le retrait de son dernier champ part avec lui, de proche en proche, tant que son absence est admise', () => {
    expect(avecLaValeur(schema, { a: { id: 'x', b: { m: 1 } } }, ['a', 'b', 'm'], undefined), '`a` garde son `id` requis').toEqual({ ok: true, valeur: { a: { id: 'x' } } });
    const sansId = z.strictObject({ a: z.strictObject({ b: z.strictObject({ m: z.number().optional() }).optional() }).optional() });
    expect(avecLaValeur(sansId, { a: { b: { m: 1 } } }, ['a', 'b', 'm'], undefined)).toEqual({ ok: true, valeur: {} });
    expect(avecLaValeur(sansId, { a: { b: { m: 1 } } }, ['a', 'b'], {}), 'poser sa valeur neuve ne retire rien').toEqual({ ok: true, valeur: { a: { b: {} } } });
  });

  it('refuse un pas sous un objet absent, une clé non déclarée, un rang hors d’une liste, le retrait d’un champ requis, chacun avec sa raison', () => {
    expect(avecLaValeur(schema, {}, ['a', 'n'], 1)).toEqual({ ok: false, refus: 'nonOffert' });
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 'z'], 1)).toEqual({ ok: false, refus: 'nonOffert' });
    expect(avecLaValeur(schema, { a: { id: 'x' } }, ['a', 0], 1)).toEqual({ ok: false, refus: 'nonOffert' });
    expect(avecLaValeur(schema, { a: { id: 'x' } }, [], 1)).toEqual({ ok: false, refus: 'nonOffert' });
    expect(avecLaValeur(z.strictObject({ r: z.number() }), { r: 1 }, ['r'], undefined), 'un champ requis ne se retire pas').toEqual({ ok: false, refus: 'horsSorte' });
    expect(avecLaValeur(z.strictObject({ r: z.number() }), { r: 1 }, ['r'], null), 'un JSON illisible arrive `null`').toEqual({ ok: false, refus: 'illisible' });
  });

  it('un rang de liste s’écrit au chemin, entier, dans la liste présente ; la liste s’écrit entière par l’un de ses gestes', () => {
    const liste = z.strictObject({ l: z.array(z.strictObject({ n: z.number(), t: z.string().optional() })).optional() });
    const l = [{ n: 1 }, { n: 2 }];
    expect(avecLaValeur(liste, { l }, ['l', 1, 'n'], 5)).toEqual({ ok: true, valeur: { l: [{ n: 1 }, { n: 5 }] } });
    for (const rang of [2, -1, 0.5, '1']) expect(avecLaValeur(liste, { l }, ['l', rang, 'n'], 5), String(rang)).toEqual({ ok: false, refus: 'nonOffert' });
    const gestes = gestesDeLaListe(l, { n: 0 });
    expect(gestes).toEqual({ ajouter: [...l, { n: 0 }], elements: [{ retirer: [{ n: 2 }], monter: null }, { retirer: [{ n: 1 }], monter: [{ n: 2 }, { n: 1 }] }] });
    for (const jouee of [gestes.ajouter, gestes.elements[0].retirer, gestes.elements[1].monter]) expect(avecLaValeur(liste, { l }, ['l'], jouee)).toEqual({ ok: true, valeur: { l: jouee } });
    expect(avecLaValeur(liste, { l }, ['l'], [{ n: 1 }, { n: 'deux' }])).toEqual({ ok: false, refus: 'horsSorte' });
    expect(avecLaValeur(liste, { l: [{ n: 1 }] }, ['l'], []), 'vidée, la liste dont l’absence est admise part').toEqual({ ok: true, valeur: {} });
    expect(avecLaValeur(z.strictObject({ l: z.array(z.number()) }), { l: [1] }, ['l'], []), 'requise, elle reste vide').toEqual({ ok: true, valeur: { l: [] } });
  });
});

describe('le geste `valeur` de la session', () => {
  const ouverte = (): { s: SessionDEdition; id: string; trig: string } => {
    const { scene } = addEffectZone(emptyScene('s', 4, 4), { x: 0, y: 0, w: 2, h: 2 });
    const avecTrig = addTrigger(scene, { x: 3, y: 3, w: 1, h: 1 });
    return { s: ouvrirLEdition({ scenes: [avecTrig.scene] } as unknown as Parameters<typeof ouvrirLEdition>[0], false), id: scene.effectZones![0].id, trig: avecTrig.id };
  };
  const { s: depart, id, trig } = ouverte();
  const porteur = { sorte: 'zone' as const, id };
  const surTrig = { sorte: 'declencheur' as const, id: trig };
  const geste = (p: { sorte: 'zone' | 'declencheur'; id: string }, chemin: Segment[], valeur: unknown[]): Extract<GesteDEdition, { geste: 'valeur' }> =>
    ({ geste: 'valeur', porteur: p, chemin, ...(valeur.length ? { valeur: valeur[0] } : {}) });
  const jouer = (s: SessionDEdition, chemin: Segment[], ...valeur: unknown[]): SessionDEdition => editer(s, geste(porteur, chemin, valeur));
  const surDeclencheur = (s: SessionDEdition, chemin: Segment[], ...valeur: unknown[]): SessionDEdition => editer(s, geste(surTrig, chemin, valeur));
  const laZone = (s: SessionDEdition) => sceneEditee(s).effectZones![0];
  const leWhen = (s: SessionDEdition) => sceneEditee(s).triggers.find((t) => t.id === trig)!.when;

  it('ajoute le Test vide, y écrit chaque champ de sa sorte, retire le dernier avec le Test ; annuler et rétablir le suivent', () => {
    const ajoute = jouer(depart, ['crossTest'], {});
    expect(laZone(ajoute).crossTest).toEqual({});
    expect(jouer(ajoute, ['crossTest', 'characteristic']), 'retirer un champ absent ne vide pas le Test ajouté').toBe(ajoute);
    const ecrit = jouer(jouer(jouer(ajoute, ['crossTest', 'characteristic'], 'force'), ['crossTest', 'difficulty'], 'difficile'), ['crossTest', 'requireSL'], 1.5);
    expect(laZone(ecrit).crossTest).toEqual({ characteristic: 'force', difficulty: 'difficile', requireSL: 1.5 });
    expect(jouer(ecrit, ['crossTest', 'characteristic'], 'force'), 'la même valeur n’ajoute aucun cran').toBe(ecrit);

    const vide = jouer(jouer(jouer(ecrit, ['crossTest', 'requireSL']), ['crossTest', 'difficulty']), ['crossTest', 'characteristic']);
    expect(laZone(vide).crossTest, 'le Test vidé quitte la zone').toBeUndefined();
    const annule = editer(vide, { geste: 'annuler' });
    expect(laZone(annule).crossTest).toEqual({ characteristic: 'force' });
    expect(laZone(editer(annule, { geste: 'retablir' })).crossTest).toBeUndefined();
  });

  it('ajoute, change de variante, remplit, monte et retire les ops d’une liste ; la liste vidée quitte la zone', () => {
    const element = elementDuNoeud(formulaireDe('zone', laZone(depart), SANS_PRESET)[1].noeud);
    const neuve = valeurNeuveDe(element);
    const ajoutee = jouer(depart, ['onCross'], gestesDeLaListe([], neuve).ajouter);
    expect(laZone(ajoutee).onCross).toEqual([neuve]);
    const corruption = jouer(ajoutee, ['onCross', 0], newOp('corruption'));
    expect(laZone(corruption).onCross, 'changer de variante pose l’op neuve choisie').toEqual([newOp('corruption')]);
    const deux = jouer(jouer(corruption, ['onCross'], gestesDeLaListe(laZone(corruption).onCross!, neuve).ajouter), ['onCross', 1], newOp('charMod'));
    const remplie = jouer(jouer(deux, ['onCross', 0, 'amount'], 3), ['onCross', 1, 'characteristic'], 'agilite');
    expect(laZone(remplie).onCross).toEqual([{ ...newOp('corruption'), amount: 3 }, { ...newOp('charMod'), characteristic: 'agilite' }]);
    expect(jouer(remplie, ['onCross', 1, 'op'], 'corruption'), 'le discriminant se change par le choix de la variante').toBe(remplie);
    const ops = laZone(remplie).onCross!;
    const montee = jouer(remplie, ['onCross'], gestesDeLaListe(ops, neuve).elements[1].monter);
    expect(laZone(montee).onCross).toEqual([ops[1], ops[0]]);
    const une = jouer(montee, ['onCross'], gestesDeLaListe(laZone(montee).onCross!, neuve).elements[0].retirer);
    expect(laZone(une).onCross).toEqual([ops[0]]);
    expect(laZone(jouer(une, ['onCross'], [])).onCross, 'vidée, elle quitte la zone').toBeUndefined();
  });

  it('écrit la condition d’un déclencheur : ET enveloppe la courante, une variante NON s’y choisit, une variante interne se choisit au même chemin, la condition se retire', () => {
    const flag: Condition = { kind: 'flag', expr: 'porte' };
    const pose = surDeclencheur(depart, ['when'], recast(CONDITION_TOUJOURS, 'flag'));
    const ecrite = surDeclencheur(pose, ['when', 'expr'], 'porte');
    expect(leWhen(ecrite)).toEqual(flag);
    const tous = surDeclencheur(ecrite, ['when'], recast(flag, 'all'));
    expect(leWhen(tous)).toEqual({ kind: 'all', of: [flag] });
    const avecNon = surDeclencheur(surDeclencheur(tous, ['when', 'of'], [flag, CONDITION_TOUJOURS]), ['when', 'of', 1], recast(CONDITION_TOUJOURS, 'not'));
    expect(leWhen(avecNon)).toEqual({ kind: 'all', of: [flag, { kind: 'not', of: CONDITION_TOUJOURS }] });
    const possede = surDeclencheur(avecNon, ['when', 'of', 1, 'of'], recast(CONDITION_TOUJOURS, 'has'));
    const has = recast(CONDITION_TOUJOURS, 'has');
    const parTrait = variantesAChoisir(varianteCourante(unionDuNoeud(conditionSchema)!, has)!.noeud, has)!.find((v) => v.cle === 'trait')!.valeur;
    const ecritTrait = surDeclencheur(possede, ['when', 'of', 1, 'of'], parTrait);
    expect(leWhen(ecritTrait)).toEqual({ kind: 'all', of: [flag, { kind: 'not', of: parTrait }] });
    expect(parTrait).toMatchObject({ kind: 'has', what: 'trait' });
    const retiree = surDeclencheur(ecritTrait, ['when']);
    expect(leWhen(retiree), 'la condition se retire').toBeUndefined();
    expect('when' in sceneEditee(retiree).triggers.find((t) => t.id === trig)!, 'sans clé laissée à `undefined`').toBe(false);
  });

  it('refuse une valeur hors de la sorte de son champ, un champ que le formulaire n’offre pas, un porteur absent, et dit pourquoi', () => {
    const ajoute = jouer(depart, ['crossTest'], {});
    for (const [chemin, valeur, refus] of [
      [['crossTest', 'characteristic'], 'vigueur', 'horsSorte'],
      [['crossTest', 'requireSL'], 'deux', 'horsSorte'],
      [['crossTest', 'requireSL'], Number.POSITIVE_INFINITY, 'horsSorte'],
      [['crossTest', 'label'], 3, 'horsSorte'],
      [['crossTest', 'easierIf'], { steps: 1 }, 'horsSorte'],
      [['crossTest', 'skill', 'id'], 'athletisme', 'nonOffert'],
      [['perRound'], [{ op: 'pas-une-op' }], 'horsSorte'],
      [['label'], 'Autre', 'nonOffert'],
      [['id'], 'autre', 'nonOffert'],
    ] as [Segment[], unknown, string][]) {
      expect(jouer(ajoute, chemin, valeur), `${chemin.join('/')} ← ${String(valeur)}`).toBe(ajoute);
      expect(refusDeLaValeur(ajoute, geste(porteur, chemin, [valeur])), chemin.join('/')).toBe(refus);
    }
    expect(refusDeLaValeur(ajoute, geste({ sorte: 'zone', id: 'nulle-part' }, ['crossTest', 'characteristic'], ['force']))).toBe('nonOffert');
    expect(laZone(jouer(jouer(ajoute, ['crossTest', 'skill'], valeurNeuveDe(refOuSpec('skill'))), ['crossTest', 'skill', 'id'], 'athletisme')).crossTest, 'la référence de Compétence se choisit').toEqual({ skill: { id: 'athletisme' } });

    const avecOps = jouer(depart, ['onCross'], [{ op: 'wounds', amount: 5 }]);
    expect(laZone(jouer(avecOps, ['onCross', 0], { op: 'wounds', amount: 3 })).onCross, 'une op non typée s’écrit en JSON que son schéma parse').toEqual([{ op: 'wounds', amount: 3 }]);
    expect(refusDeLaValeur(avecOps, geste(porteur, ['onCross', 0], [null])), 'un JSON illisible').toBe('illisible');
    expect(refusDeLaValeur(avecOps, geste(porteur, ['onCross', 0], [{ op: 'pas-une-op' }]))).toBe('horsSorte');
    expect(refusDeLaValeur(avecOps, geste(porteur, ['onCross', 0, 'amount'], [3])), 'une op sans forme déclarée n’offre aucun champ').toBe('nonOffert');
    const avecHas = surDeclencheur(depart, ['when'], recast(CONDITION_TOUJOURS, 'has'));
    expect(refusDeLaValeur(avecHas, geste(surTrig, ['when', 'what'], ['trait'])), 'un discriminant se change par le choix de la variante').toBe('nonOffert');
    expect(refusDeLaValeur(avecHas, geste(surTrig, ['flow'], [{ kind: 'seq', steps: [] }])), 'le flux n’est pas offert').toBe('nonOffert');
    expect(refusDeLaValeur(avecHas, geste(surTrig, ['when', 'who'], ['caster']))).toBeNull();
  });
});

describe('les choix d’une union réunissent ses références, ses énumérations et ses littéraux (#3606 M1a)', () => {
  const ids = (type: 'species' | 'planDeBestiaire' | 'career' | 'trait') => choixDeLaFeuilleDId({ type }).map((e) => e.id);

  it('l’espèce d’une apparence : les 27 espèces puis les 102 du plan de bestiaire', () => {
    const choix = choixDuNoeud(especeDApparenceSchema)!.map((o) => o.valeur);
    expect([ids('species').length, ids('planDeBestiaire').length]).toEqual([27, 102]);
    expect(choix).toEqual([...ids('species'), ...ids('planDeBestiaire')]);
    expect(choix).toHaveLength(129);
  });

  it('la tenue : les 108 carrières puis « nu »', () => {
    const choix = choixDuNoeud(tenueFermeeSchema)!.map((o) => o.valeur);
    expect(choix).toEqual([...ids('career'), 'nu']);
    expect(choix).toHaveLength(109);
  });

  it('les choix d’une feuille unique et sa valeur neuve sont inchangés : la difficulté d’un Test de traversée, le Trait d’une condition d’entrée', () => {
    const z = zone({ crossTest: { characteristic: 'force' } });
    const difficulte = champ(formulaireDe('zone', z, SANS_PRESET), z, 'crossTest', 'difficulty').noeud;
    expect(choixDuNoeud(difficulte)).toEqual(Object.entries(DIFFICULTY_LABELS).map(([valeur, libelle]) => ({ valeur, libelle })));
    expect(valeurNeuveDe(difficulte)).toBe(Object.keys(DIFFICULTY_LABELS)[0]);
    const d = declencheur({ kind: 'has', who: 'target', what: 'trait', value: 'a-distance' } as Condition);
    const trait = champ(formulaireDe('declencheur', d, SANS_PRESET), d, 'when', 'value').noeud;
    expect(choixDuNoeud(trait)).toEqual(choixDeLaFeuilleDId({ type: 'trait' }).map((e) => ({ valeur: e.id, libelle: e.label })));
    expect(valeurNeuveDe(trait)).toBe(ids('trait')[0]);
  });
});

describe('une union se lit à la présence de son discriminant : les options d’un statbloc (LDB 76 ; #3606 M1a)', () => {
  const u = unionDuNoeud(optionalEntrySchema)!;
  const note = { note: 'swap', label: 'Remplacer Bestial par un bonus de +20 en Soc', remove: ['bestial'], grant: [{ characteristic: 'sociabilite', value: 20 }] };

  it('reconnaît le Trait, sans `note`, et chaque note par sa valeur', () => {
    expect([u.discriminant, u.variantes.map((v) => [v.cle, v.libelle])]).toEqual(['note', [['', 'Trait'], ['all-traits', 'tous les Traits'], ['swap', 'remplacement de Traits']]]);
    expect(varianteCourante(u, { id: 'rapide' })?.cle).toBe('');
    expect(varianteCourante(u, note)?.cle).toBe('swap');
    expect(formeAuPoint(optionalEntrySchema, note)?.tenus, 'la note se tient par le choix de sa variante').toEqual(['note']);
  });

  it('la variante Trait se pose sans `note` ; une note posée entière se garde à son choix', () => {
    const variantes = variantesAChoisir(optionalEntrySchema, note)!;
    expect(variantes.find((v) => v.cle === '')?.valeur).toEqual({ id: choixDeLaFeuilleDId({ type: 'trait' })[0].id });
    expect(variantes.find((v) => v.cle === 'swap')).toMatchObject({ courante: true, valeur: note });
  });
});
