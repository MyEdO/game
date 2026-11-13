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
import type { SourceDeLEdition } from './adresseDeProse';
import { emptyNarratif } from '../monde/campaignNarratif';
import { emptyScene, type Dialogue, type EncounterDef, type Scene } from '../monde/scene';
import { addEffectZone, addTrigger, avecLaValeur, avecLaValeurDuPorteur, type Segment } from '../sceneEdit';
import { choixDuChamp, ecritureOfferte, formulaireDe, porteurDeLaPortee, porteurDeLaSel, porteurDuProjet, porteursDuProjet, projetAvecLePorteur, type AccesDuPorteur, type CadreDuPorteur, type ProjetDEdition, type Sel } from '../sceneEditLecture';
import { emptyWorldMap, type WorldMap } from '../worldMap';
import { gestesDeLaListe, newEffect, newOp, valeurNeuveDe, variantesAChoisir } from '../valeursNeuves';
import seaEventsJson from '../../data/sea-events.json';
import { givePossessionSchema } from '../../data/schemas/defs-scenes/effets';
import { bornesAuPoint, champDeLElement, champsDeclares, champsDuRecord, champsOfferts, choixDuNoeud, cleOfferte, elementDuNoeud, formeAuPoint, inferFields, kindDuNoeud, recordDuNoeud, unionDuNoeud, varianteCourante, type FieldDesc } from '../codex/editFields';
import { ouverts } from '../../data/schemas/grammaire/descente';
import { tableTotale } from '../../lib/tableTotale';
import { editer, ouvrirLEdition, refusDeLaValeur, sceneEditee, type GesteDEdition, type SessionDEdition } from './session';
import { conditionSchema, flowTestSchema, OP_DEFS, OP_LABEL, OPS_NON_TYPEES } from '../../data/schemas/grammaire/mecanique';
import { idDe, idsDe, idsDeLaSousListe, refOuSpec } from '../../data/schemas/grammaire/ref';
import { CIBLE_D_APPARTENANCE } from '../../data/schemas/grammaire/sousListes';
import { CONDITION_TOUJOURS, recast, statblockDeLaCreature } from '../../data/valeursNeuves';
import { DIFFICULTY_LABELS } from '../../engine/types';
import type { Condition } from '../../engine/flowCore';
import type { GameOp } from '../../engine/ops';
import { choixDeLaFeuilleDId, creatureSemee, findCreatureById } from '../../data';
import { especeDApparenceSchema, tenueFermeeSchema } from '../../data/schemas/grammaire/valeurs';
import { optionalEntrySchema } from '../../data/schemas/defs/creatures';
import { dialogueNodeSchema, dialogueSchema, encounterDefSchema, victoryConditionSchema } from '../../data/schemas/defs-scenes/scene';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';

/** Un narratif vide : aucun preset de PNJ, aucune entrée à référencer. */
const NARRATIF_VIDE = emptyNarratif();

/** Aucun `Source/` servi : aucun chapitre. */
const SANS_SOURCE: SourceDeLEdition = { manifeste: null, chapitres: {} };

/** Le cadre d'un porteur d'une scène vide, au narratif vide. */
const CADRE_VIDE: CadreDuPorteur = { scene: emptyScene('s', 4, 4), projet: { scenes: [], narratif: NARRATIF_VIDE }, source: SANS_SOURCE };

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
    const champs = formulaireDe('zone', zone(), CADRE_VIDE);
    expect(champs.map((c) => [c.key, c.label, c.nullable])).toEqual([['crossTest', 'Test de traversée', true], ['onCross', 'à la traversée', true], ['perRound', 'par Round', true], ['rendu', 'rendu', true]]);
    expect(valeurNeuveDe(champs[0].noeud)).toEqual({});
    for (const liste of champs.slice(1, 3)) expect(unionDuNoeud(elementDuNoeud(liste.noeud))?.discriminant, liste.key).toBe('op');
  });

  it('barrée, elle offre aussi les groupes qu’elle bloque, chacun au catalogue des Groupes qu’une appartenance cible', () => {
    const z = zone({ barrier: {} });
    const champs = formulaireDe('zone', z, CADRE_VIDE);
    expect(champs.map((c) => c.key)).toEqual(['crossTest', 'onCross', 'perRound', 'rendu', 'barrier']);
    const groupes = champ(champs, z, 'barrier', 'blockGroups');
    expect(choixDuNoeud(elementDuNoeud(groupes.noeud))?.map((o) => o.valeur)).toEqual(idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE));
  });

  it('décrit le Test présent : la référence de Compétence au catalogue, la caractéristique et la difficulté au choix, les nombres bornés, sa garde en Condition, ses listes, son enjeu choisi par variante', () => {
    const z = zone({ crossTest: { skill: { id: 'athletisme' as never }, characteristic: 'force', requireSL: 2 } });
    const champs = formulaireDe('zone', z, CADRE_VIDE);
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
    expect([champsDeclares(enjeu.noeud), unionDuNoeud(enjeu.noeud)?.variantes.map((v) => v.cle), elementDuNoeud(enjeu.noeud)], 'une union sans discriminant se choisit par ses branches, de clé leur rang').toEqual([undefined, ['0', '1', '2'], undefined]);
  });

  it('une référence se choisit dans la sous-liste que sa feuille déclare', () => {
    const schema = z.strictObject({ groupe: idDe('groupe', CIBLE_D_APPARTENANCE) });
    const hors = [...idsDe('groupe')].find((id) => !idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE).includes(id))!;
    expect(valeurNeuveDe(schema)).toEqual({ groupe: idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE)[0] });
    expect(avecLaValeur(schema, { groupe: 'x' }, ['groupe'], hors), 'hors de la sous-liste').toEqual({ ok: false, refus: 'horsSorte' });
  });

  it('une op se choisit parmi toutes, chacune nommée, neuve par `newOp` ; typée, elle se décrit champ par champ, son `op` tenu par le choix', () => {
    const z = zone({ onCross: [{ op: 'charMod', characteristic: 'force', mod: -10 }] as never });
    const champs = formulaireDe('zone', z, CADRE_VIDE);
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
    expect(OPS_NON_TYPEES).toContain('statusMod');
    const valeur = { op: 'statusMod', amount: 1 };
    const noeud = elementDuNoeud(formulaireDe('zone', zone({ onCross: [valeur] as never }), CADRE_VIDE)[1].noeud);
    const u = unionDuNoeud(noeud)!;
    expect(varianteCourante(u, valeur)).toMatchObject({ cle: 'statusMod', noeud: undefined });
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
    const champs = formulaireDe('declencheur', d, CADRE_VIDE);
    expect(champs.map((c) => [c.key, c.nullable]), 'la condition d’entrée, absente admise, puis le flux, requis').toEqual([['when', true], ['flow', false]]);
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
    const noeud = formulaireDe('declencheur', declencheur(has), CADRE_VIDE)[0].noeud;
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

  it('un retrait refuse la faute qu’il fait naître au parse de l’objet, dite ; un retrait sans faute neuve et un ajout incomplet s’écrivent (#3606, décision 3)', () => {
    const noeud = (id: string, next?: string) => ({ ...(valeurNeuveDe(dialogueNodeSchema) as object), id, desc: `Réplique ${id}.`, choices: next ? [{ id: `${id}-suite`, label: 'suite', next: { id: next } }] : [] });
    const dialogue = { id: 'd', start: { id: 'a' }, nodes: [noeud('a', 'c'), noeud('b'), noeud('c', 'mort')] };
    const deja = dialogueSchema.safeParse(dialogue).error?.issues.map((i) => i.path.slice(0, 5));
    expect(deja, 'la référence morte du nœud `c` est une faute préexistante').toEqual([['nodes', 2, 'choices', 0, 'next']]);
    const gestes = gestesDeLaListe(dialogue.nodes, valeurNeuveDe(dialogueNodeSchema));
    const [sansA, sansB, sansC] = gestes.elements.map((e) => e.retirer);
    const fauteAu = (nodes: unknown[], chemin: Segment[]) => dialogueSchema.safeParse({ ...dialogue, nodes }).error!.issues.find((i) => jsonCanonique(i.path.slice(0, chemin.length)) === jsonCanonique(chemin))!.message;
    expect(avecLaValeur(dialogueSchema, dialogue, ['nodes'], sansA), 'le nœud de départ').toEqual({ ok: false, refus: { regle: fauteAu(sansA, ['start']) } });
    expect(avecLaValeur(dialogueSchema, dialogue, ['nodes'], sansC), 'le nœud suivant d’une réponse').toEqual({ ok: false, refus: { regle: fauteAu(sansC, ['nodes', 0, 'choices', 0, 'next']) } });
    expect(avecLaValeur(dialogueSchema, dialogue, ['nodes'], sansB), 'non référencé : la faute de `c` passe du rang 2 au rang 1, déjà là').toEqual({ ok: true, valeur: { ...dialogue, nodes: sansB } });
    expect(dialogueSchema.safeParse({ ...dialogue, nodes: gestes.ajouter }).error?.issues.length, 'le nœud neuf porte une faute neuve').toBeGreaterThan(deja!.length);
    expect(avecLaValeur(dialogueSchema, dialogue, ['nodes'], gestes.ajouter)).toEqual({ ok: true, valeur: { ...dialogue, nodes: gestes.ajouter } });
  });
});

describe('le geste `valeur` de la session', () => {
  const ouverte = (): { s: SessionDEdition; id: string; trig: string } => {
    const { scene } = addEffectZone(emptyScene('s', 4, 4), { x: 0, y: 0, w: 2, h: 2 });
    const avecTrig = addTrigger(scene, { x: 3, y: 3, w: 1, h: 1 });
    return { s: ouvrirLEdition({ scenes: [avecTrig.scene], narratif: NARRATIF_VIDE } as unknown as Parameters<typeof ouvrirLEdition>[0], false), id: scene.effectZones![0].id, trig: avecTrig.id };
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
    const element = elementDuNoeud(formulaireDe('zone', laZone(depart), CADRE_VIDE)[1].noeud);
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

    const avecOps = jouer(depart, ['onCross'], [{ op: 'statusMod', amount: 1 }]);
    expect(laZone(jouer(avecOps, ['onCross', 0], { op: 'statusMod', amount: 2 })).onCross, 'une op non typée s’écrit en JSON que son schéma parse').toEqual([{ op: 'statusMod', amount: 2 }]);
    expect(refusDeLaValeur(avecOps, geste(porteur, ['onCross', 0], [null])), 'un JSON illisible').toBe('illisible');
    expect(refusDeLaValeur(avecOps, geste(porteur, ['onCross', 0], [{ op: 'pas-une-op' }]))).toBe('horsSorte');
    expect(refusDeLaValeur(avecOps, geste(porteur, ['onCross', 0, 'amount'], [3])), 'une op sans forme déclarée n’offre aucun champ').toBe('nonOffert');
    const avecHas = surDeclencheur(depart, ['when'], recast(CONDITION_TOUJOURS, 'has'));
    expect(refusDeLaValeur(avecHas, geste(surTrig, ['when', 'what'], ['trait'])), 'un discriminant se change par le choix de la variante').toBe('nonOffert');
    for (const chemin of [['once'], ['rect', 'z']] as Segment[][]) {
      expect(refusDeLaValeur(avecHas, geste(surTrig, chemin, [1])), `${chemin.join('/')} : un champ qu’un geste dédié écrit, hors du formulaire`).toBe('nonOffert');
    }
    expect(refusDeLaValeur(avecHas, geste(surTrig, ['when', 'who'], ['caster']))).toBeNull();
  });
});

describe('les choix d’une union réunissent ses références, ses énumérations et ses littéraux (#3606 M1a)', () => {
  const ids = (type: 'species' | 'planDeBestiaire' | 'career' | 'trait') => choixDeLaFeuilleDId({ type }).map((e) => e.id);

  it('l’espèce d’une apparence : les espèces puis celles du plan de bestiaire', () => {
    const choix = choixDuNoeud(especeDApparenceSchema)!.map((o) => o.valeur);
    expect(Math.min(ids('species').length, ids('planDeBestiaire').length)).toBeGreaterThan(0);
    expect(choix).toEqual([...ids('species'), ...ids('planDeBestiaire')]);
  });

  it('la tenue : les carrières puis « nu »', () => {
    const choix = choixDuNoeud(tenueFermeeSchema)!.map((o) => o.valeur);
    expect(choix).toEqual([...ids('career'), 'nu']);
  });

  it('les choix d’une feuille unique et sa valeur neuve sont inchangés : la difficulté d’un Test de traversée, le Trait d’une condition d’entrée', () => {
    const z = zone({ crossTest: { characteristic: 'force' } });
    const difficulte = champ(formulaireDe('zone', z, CADRE_VIDE), z, 'crossTest', 'difficulty').noeud;
    expect(choixDuNoeud(difficulte)).toEqual(Object.entries(DIFFICULTY_LABELS).map(([valeur, libelle]) => ({ valeur, libelle })));
    expect(valeurNeuveDe(difficulte)).toBe(Object.keys(DIFFICULTY_LABELS)[0]);
    const d = declencheur({ kind: 'has', who: 'target', what: 'trait', value: 'a-distance' } as Condition);
    const trait = champ(formulaireDe('declencheur', d, CADRE_VIDE), d, 'when', 'value').noeud;
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

/** La première Condition « Bourse ≥ » de `sea-events.json`, d'où se lit une valeur liée réelle (MDG 15 l.245-247). */
function bourseLiee(): Condition {
  const pile: unknown[] = [seaEventsJson];
  for (let v = pile.pop(); v !== undefined; v = pile.pop()) {
    if (v !== null && typeof v === 'object' && (v as { kind?: unknown }).kind === 'money') return v as Condition;
    if (v !== null && typeof v === 'object') pile.push(...Object.values(v));
  }
  throw new Error('aucune Condition « money » dans sea-events.json');
}

describe('une union sans discriminant se lit à la forme de ses branches : la Bourse et la référence d’une possession (#3606 M2e2)', () => {
  it('la Bourse ≥ offre « Montant » et « Valeur liée », qui partagent `brass` ; la courante est celle dont la valeur a la forme', () => {
    const montant = recast(CONDITION_TOUJOURS, 'money');
    const liee = bourseLiee();
    expect([montant, liee].map((c) => (c as { atLeast: unknown }).atLeast)).toEqual([{ gold: 1 }, { brass: { tire: expect.any(String) } }]);
    const noeud = (c: Condition) => { const d = declencheur(c); return champ(formulaireDe('declencheur', d, CADRE_VIDE), d, 'when', 'atLeast').noeud; };
    const u = unionDuNoeud(noeud(liee))!;
    expect(u.variantes.map((v) => [v.cle, v.libelle])).toEqual([['0', 'Montant'], ['1', 'Valeur liée']]);
    expect([montant, liee].map((c) => varianteCourante(u, (c as { atLeast: unknown }).atLeast)?.libelle)).toEqual(['Montant', 'Valeur liée']);
    for (const [actuelle, vers] of [[liee, 'Montant'], [montant, 'Valeur liée']] as const) {
      const choisie = variantesAChoisir(noeud(actuelle), (actuelle as { atLeast: unknown }).atLeast)!.find((v) => v.libelle === vers)!;
      const ecrite = avecLaValeur(conditionSchema, actuelle, ['atLeast'], choisie.valeur);
      if (!ecrite.ok) throw new Error(`${vers} : ${ecrite.refus}`);
      expect(varianteCourante(u, ecrite.valeur.atLeast)?.libelle, `${vers} : courante une fois écrite`).toBe(vers);
      const issues = conditionSchema.safeParse(ecrite.valeur).error?.issues.map((i) => [i.code, i.path.join('.')]) ?? [];
      expect(issues, `${vers} : le parse n’y refuse que la valeur liée encore vide`).toEqual(vers === 'Montant' ? [] : [['too_small', 'atLeast.brass.tire']]);
    }
  });

  it('la référence d’une possession offre « Créature ou véhicule », elle-même union discriminée, et « profil personnalisé » ; la courante est celle dont la valeur a la forme', () => {
    const effet = newEffect('givePossession') as Extract<ReturnType<typeof newEffect>, { type: 'givePossession' }>;
    const statbloc = { custom: statblockDeLaCreature(findCreatureById(creatureSemee())!) };
    const parStatbloc = { ...effet, ref: statbloc };
    const d = (e: unknown) => ({ ...declencheur(), flow: { kind: 'effet', effet: e } } as Declencheur);
    const noeud = (e: unknown) => champ(formulaireDe('declencheur', d(e), CADRE_VIDE), d(e), 'flow', 'effet', 'ref').noeud;
    const u = unionDuNoeud(noeud(effet))!;
    expect(u.variantes.map((v) => [v.cle, v.libelle])).toEqual([['0', 'Créature ou véhicule'], ['1', 'profil personnalisé']]);
    expect(unionDuNoeud(u.variantes[0].noeud)?.discriminant, 'la référence se choisit encore par son type').toBe('type');
    expect([effet.ref, statbloc].map((r) => varianteCourante(u, r)?.cle)).toEqual(['0', '1']);
    expect(givePossessionSchema.safeParse(parStatbloc).success, 'le statbloc réel parse').toBe(true);
    for (const [actuelle, vers] of [[effet, '1'], [parStatbloc, '0']] as const) {
      const choisie = variantesAChoisir(noeud(actuelle), actuelle.ref)!.find((v) => v.cle === vers)!;
      const ecrite = avecLaValeur(givePossessionSchema, actuelle, ['ref'], choisie.valeur);
      if (!ecrite.ok) throw new Error(`${vers} : ${ecrite.refus}`);
      expect([varianteCourante(u, ecrite.valeur.ref)?.cle, givePossessionSchema.safeParse(ecrite.valeur).success], `${vers} : courante et admise par le parse`).toEqual([vers, true]);
    }
  });
});

/** Un dialogue à deux nœuds : le départ `a` porte une réponse gardée, payante, à effet, qui mène à `b`. */
const DIALOGUE: Dialogue = {
  id: 'd',
  start: { id: 'a' },
  nodes: [
    { id: 'a', choices: [{ id: 'suivre', label: 'Suivre', when: { kind: 'flag', expr: 'x' }, cost: { gold: 1 }, flow: { kind: 'effet', effet: { type: 'fall', target: 'groupe', metres: 4 } }, next: { id: 'b' } }] },
    { id: 'b', choices: [] },
  ],
};

/** Une scène qui déclare `DIALOGUE`, un personnage `pnj` et un décor `table`. */
const SCENE_DU_DIALOGUE: Scene = {
  ...emptyScene('s', 4, 4),
  dialogues: [DIALOGUE],
  entities: [{ kind: 'personnage', id: 'pnj', pos: { x: 0, y: 0 } }, { kind: 'prop', id: 'table', ref: 'x', pos: { x: 1, y: 1 } }] as Scene['entities'],
};

/** Le cadre de `DIALOGUE`, dans sa scène. */
const CADRE_DU_DIALOGUE: CadreDuPorteur = { ...CADRE_VIDE, scene: SCENE_DU_DIALOGUE };

describe('le formulaire d’un dialogue (#3606 M3b1a)', () => {
  it('offre son nœud de départ, ses nœuds et les entrées qu’il couvre', () => {
    expect(formulaireDe('dialogue', DIALOGUE, CADRE_DU_DIALOGUE).map((c) => c.key)).toEqual(['start', 'nodes', 'couvre']);
  });

  it('le nœud de départ et le nœud suivant d’une réponse se choisissent parmi ses nœuds, posés `{ id }` ; le locuteur parmi les personnages de la scène (#3606)', () => {
    const noeuds = [{ valeur: { id: 'a' }, libelle: 'a', refus: null }, { valeur: { id: 'b' }, libelle: 'b', refus: null }];
    expect(choixDuChamp('dialogue', DIALOGUE, ['start'], CADRE_DU_DIALOGUE)).toEqual(noeuds);
    expect(choixDuChamp('dialogue', DIALOGUE, ['nodes', 0, 'choices', 0, 'next'], CADRE_DU_DIALOGUE)).toEqual(noeuds);
    expect(choixDuChamp('dialogue', DIALOGUE, ['nodes', 1, 'speakerId'], CADRE_DU_DIALOGUE)?.map((c) => c.valeur)).toEqual([{ id: 'pnj' }]);
  });

  it('au rang qui suit le dernier, le nœud neuf et le choix neuf ont un id frais, posés par leur id ; ailleurs, aucun (#3606)', () => {
    const pris = { ...DIALOGUE, nodes: [...DIALOGUE.nodes, { id: 'n3', choices: [] }] };
    expect(choixDuChamp('dialogue', pris, ['nodes', 3], CADRE_DU_DIALOGUE)).toEqual([{ valeur: { id: 'n4', choices: [] }, libelle: 'n4', refus: null }]);
    expect(choixDuChamp('dialogue', DIALOGUE, ['nodes', 0, 'choices', 1], CADRE_DU_DIALOGUE)).toEqual([{ valeur: { id: 'choix-0', label: '' }, libelle: 'choix-0', refus: null }]);
    expect(choixDuChamp('dialogue', DIALOGUE, ['nodes', 1, 'choices', 0], CADRE_DU_DIALOGUE)?.[0].valeur).toEqual({ id: 'choix-0', label: '' });
    for (const chemin of [['nodes', 1], ['nodes', 0, 'choices', 0], ['nodes', 5, 'choices', 0]] as Segment[][]) expect(choixDuChamp('dialogue', DIALOGUE, chemin, CADRE_DU_DIALOGUE), chemin.join('/')).toBeUndefined();
  });

  it('la sélection d’un dialogue désigne son porteur, comme celle d’un déclencheur, d’une zone, d’une entité ; une entrée, aucun ; aucune sélection, la scène ouverte', () => {
    expect(([{ type: 'dialogue', id: 'd' }, { type: 'trigger', id: 't' }, { type: 'effectZone', id: 'z' }, { type: 'entity', id: 'e' }, { type: 'entry', id: 'p' }, null] as Sel[]).map((sel) => porteurDeLaSel(sel, 'scene', 'salle'))).toEqual([
      { sorte: 'dialogue', id: 'd' }, { sorte: 'declencheur', id: 't' }, { sorte: 'zone', id: 'z' }, { sorte: 'entite', id: 'e' }, undefined, { sorte: 'scene', id: 'salle' },
    ]);
  });

  describe('le geste `valeur` sur un dialogue', () => {
    const depart = ouvrirLEdition({ scenes: [SCENE_DU_DIALOGUE], narratif: NARRATIF_VIDE } as unknown as Parameters<typeof ouvrirLEdition>[0], false);
    const jouer = (s: SessionDEdition, chemin: Segment[], ...valeur: unknown[]): SessionDEdition =>
      editer(s, { geste: 'valeur', porteur: { sorte: 'dialogue', id: 'd' }, chemin, ...(valeur.length ? { valeur: valeur[0] } : {}) });
    const leDialogue = (s: SessionDEdition) => sceneEditee(s).dialogues[0];
    const laReponse = (s: SessionDEdition) => leDialogue(s).nodes[0].choices[0];

    it('écrit le départ, ajoute un nœud et une réponse, écrit son libellé, son suivant, le locuteur, le coût et la condition d’une réponse, les entrées couvertes', () => {
      const [neuf] = choixDuChamp('dialogue', DIALOGUE, ['nodes', 2], CADRE_DU_DIALOGUE)!;
      const ajoute = jouer(depart, ['nodes'], [...DIALOGUE.nodes, neuf.valeur]);
      const [reponse] = choixDuChamp('dialogue', leDialogue(ajoute), ['nodes', 2, 'choices', 0], CADRE_DU_DIALOGUE)!;
      const ecrit = ([
        [['start'], { id: 'n3' }],
        [['nodes', 2, 'choices'], [reponse.valeur]],
        [['nodes', 2, 'choices', 0, 'label'], 'Partir'],
        [['nodes', 2, 'choices', 0, 'next'], { id: 'a' }],
        [['nodes', 2, 'speakerId'], { id: 'pnj' }],
        [['nodes', 0, 'choices', 0, 'cost', 'silver'], 3],
        [['nodes', 0, 'choices', 0, 'when', 'expr'], 'y'],
        [['couvre'], ['EDO-01#beat1']],
      ] as [Segment[], unknown][]).reduce((s, [chemin, valeur]) => jouer(s, chemin, valeur), ajoute);
      expect(leDialogue(ecrit)).toEqual({
        ...DIALOGUE,
        start: { id: 'n3' },
        couvre: ['EDO-01#beat1'],
        nodes: [
          { id: 'a', choices: [{ ...DIALOGUE.nodes[0].choices[0], when: { kind: 'flag', expr: 'y' }, cost: { gold: 1, silver: 3 } }] },
          DIALOGUE.nodes[1],
          { id: 'n3', speakerId: { id: 'pnj' }, choices: [{ id: 'choix-0', label: 'Partir', next: { id: 'a' } }] },
        ],
      });
    });

    it('un coût dont la dernière clé est retirée et un enchaînement retiré quittent la réponse', () => {
      const sansCout = jouer(jouer(depart, ['nodes', 0, 'choices', 0, 'cost', 'gold']), ['nodes', 0, 'choices', 0, 'flow']);
      expect(Object.keys(laReponse(sansCout))).toEqual(['id', 'label', 'when', 'next']);
    });
  });
});

/** La rencontre `enc` : `cavalier` y chevauche la monture `cheval`, `archer` va à pied ; sa victoire, au seuil de 50 %. */
const RENCONTRE: EncounterDef = {
  id: 'enc',
  members: [{ entityId: 'cavalier', ridesEntityId: { id: 'cheval' } }, { entityId: 'cheval', mount: true }, { entityId: 'archer' }],
  victoryCondition: { type: 'woundsThreshold', atOrBelowPercent: 50 },
};

/** Le cadre de `RENCONTRE`, dans une scène où `badaud` est un personnage hors de la rencontre. */
const CADRE_DE_LA_RENCONTRE: CadreDuPorteur = {
  ...CADRE_VIDE,
  scene: {
    ...emptyScene('s', 4, 4),
    encounters: [RENCONTRE],
    entities: ['cavalier', 'cheval', 'archer', 'badaud'].map((id) => ({ kind: 'personnage', id, pos: { x: 0, y: 0 } })) as Scene['entities'],
  },
};

describe('le formulaire d’une rencontre (#3606 M4b)', () => {
  it('offre ses circonstances, sa fin, les entrées qu’elle couvre, et de chaque membre seulement sa monture (#3606)', () => {
    const champs = formulaireDe('rencontre', RENCONTRE, CADRE_DE_LA_RENCONTRE);
    expect(champs.map((c) => c.key)).toEqual(['victoryCondition', 'onVictory', 'surprise', 'maneuverability', 'threat', 'terrain', 'banRanged', 'siege', 'couvre', 'members']);
    const offert = champs.find((c) => c.key === 'members')!.contexte!.offert;
    const sousLeMembre = (rang: number) => ['entityId', 'side', 'ai', 'mount', 'ridesEntityId'].filter((cle) => offert(['members', rang, cle]));
    expect([sousLeMembre(0), sousLeMembre(2)]).toEqual([['mount', 'ridesEntityId'], ['mount', 'ridesEntityId']]);
  });

  it('la cible de la victoire se choisit parmi les membres, la monture chevauchée parmi les montures, posées `{ id }` ; le parse refuse les autres (#3606)', () => {
    const vise = (chemin: Segment[]) => choixDuChamp('rencontre', RENCONTRE, chemin, CADRE_DE_LA_RENCONTRE)?.map((c) => c.valeur);
    expect(vise(['victoryCondition', 'targetId'])).toEqual([{ id: 'cavalier' }, { id: 'cheval' }, { id: 'archer' }]);
    expect(vise(['members', 2, 'ridesEntityId'])).toEqual([{ id: 'cheval' }]);
    const fautes = (enc: EncounterDef) => encounterDefSchema.safeParse(enc).error?.issues.map((i) => i.message) ?? [];
    expect(fautes({ ...RENCONTRE, victoryCondition: { type: 'woundsThreshold', targetId: { id: 'badaud' }, atOrBelowPercent: 50 } }))
      .toEqual([expect.stringContaining('« badaud » est absent du catalogue des membres de la rencontre')]);
    expect(fautes({ ...RENCONTRE, members: [RENCONTRE.members![0], { entityId: 'cheval' }, RENCONTRE.members![2]] }))
      .toEqual([expect.stringContaining('« cheval » est absent du catalogue des montures de la rencontre')]);
    expect(fautes(RENCONTRE)).toEqual([]);
  });

  it('une écriture sur le chemin d’un champ offert descend une liste élément par élément : la liste des membres et un membre entiers ne sont pas offerts, sa monture l’est (#3606)', () => {
    const offerts = [['members', 0, 'mount'], ['members', 0, 'ridesEntityId'], ['members', 1, 'mount'], ['members', 1, 'ridesEntityId']] as const;
    const [cavalier, cheval] = RENCONTRE.members!;
    expect(ecritureOfferte(offerts, ['members'], [cavalier, cheval])).toBe(false);
    expect(ecritureOfferte(offerts, ['members', 1], cheval)).toBe(false);
    expect(ecritureOfferte(offerts, ['members', 1, 'mount'], true)).toBe(true);
    expect(ecritureOfferte([['usable', 'actions']], ['usable'], { actions: [{ id: 'a' }] }), 'une liste sous un champ offert s’écrit entière').toBe(true);
  });

  it('chaque objectif de victoire se choisit par variante nommée ; la valeur neuve de chacune passe le parse de la rencontre (décision 3)', () => {
    const variantes = variantesAChoisir(victoryConditionSchema, undefined)!;
    expect(variantes.map((v) => [v.cle, v.libelle, v.valeur])).toEqual([
      ['allEnemiesDead', 'Tous les ennemis hors d’action', { type: 'allEnemiesDead' }],
      ['destroyStructure', 'Détruire une structure', { type: 'destroyStructure', edge: { x: 0, y: 0, side: 'N' } }],
      ['surviveRounds', 'Survivre N Rounds', { type: 'surviveRounds', rounds: 0 }],
      ['reachZone', 'Atteindre une zone', { type: 'reachZone', rect: { x: 0, y: 0, w: 0, h: 0 } }],
      ['woundsThreshold', 'Sortie à seuil de dommage', { type: 'woundsThreshold', atOrBelowPercent: 0 }],
      ['firstBlood', 'Duel judiciaire — premier sang', { type: 'firstBlood' }],
    ]);
    for (const v of variantes) expect(encounterDefSchema.safeParse({ ...RENCONTRE, victoryCondition: v.valeur }).success, v.cle).toBe(true);
  });

  it('la sélection d’une rencontre désigne son porteur', () => {
    expect(porteurDeLaSel({ type: 'encounter', id: 'enc' }, 'scene', 'salle')).toEqual({ sorte: 'rencontre', id: 'enc' });
  });
});

/** La saisie que l'hôte rend à chaque chemin des formulaires tirés du schéma (`FORMULAIRES`), toutes branches ouvertes,
 *  sans valeur, comme le descend `elementsDuChamp` (`src/hote/editeur.ts`) : `variantes` d'une union nommée, `ajouter`
 *  ou `json` d'une liste, `json` d'une op sans forme déclarée, sinon celle de la feuille (`choix`, `nombre`, `texte`,
 *  `json`). Un nœud déjà descendu ne se redescend pas. */
function saisiesDesFormulaires(): Map<string, string> {
  const saisies = new Map<string, string>();
  const vus = new Set<unknown>();
  const sous = (noeud: unknown, tenus: readonly string[] = []): FieldDesc[] => (champsDeclares(noeud) ?? [])
    .filter(([cle, n]) => !tenus.includes(cle) && cleOfferte(cle, n))
    .map(([cle, n]) => inferFields([{}], { noeud, niveau: 'profondeur' }).find((c) => c.key === cle) ?? { key: cle, label: cle, kind: kindDuNoeud(cle, n), nullable: true, noeud: n });
  const objet = (noeud: unknown, f: FieldDesc, chemin: string, tenus: readonly string[] = []) => {
    if (vus.has(noeud)) return;
    vus.add(noeud);
    for (const c of sous(noeud, tenus)) champ({ ...c, contexte: f.contexte }, `${chemin}/${c.key}`);
  };
  const feuille = (f: FieldDesc, chemin: string) => {
    const segments = chemin.replace(/<[^>]*>|\{\d*\}/g, '').split('/').slice(1).map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    const choix = f.contexte?.choix(segments) ?? choixDuNoeud(f.noeud);
    const nombre = f.kind === 'number' || bornesAuPoint(f.noeud, undefined) !== undefined;
    saisies.set(chemin, choix ? 'choix' : nombre ? 'nombre' : f.kind === 'text' || f.kind === 'textarea' ? 'texte' : 'json');
  };
  function champ(f: FieldDesc, chemin: string, tenus: readonly string[] = []): void {
    if (champsDeclares(f.noeud)) return objet(f.noeud, f, chemin, tenus);
    const u = unionDuNoeud(f.noeud);
    if (u) {
      if (!tenus.length) saisies.set(chemin, 'variantes');
      if (vus.has(u.noeud)) return;
      vus.add(u.noeud);
      for (const v of u.variantes) {
        const ici = `${chemin}<${u.discriminant || 'forme'}=${v.cle}>`;
        if (v.noeud === undefined) saisies.set(ici, 'json');
        else if (unionDuNoeud(v.noeud)) champ({ ...f, noeud: v.noeud }, ici, [...tenus, u.discriminant]);
        else if (champsDeclares(v.noeud)) objet(v.noeud, f, ici, [...tenus, u.discriminant]);
        else feuille({ ...f, noeud: v.noeud, kind: kindDuNoeud('', v.noeud) }, ici);
      }
      return;
    }
    const element = elementDuNoeud(f.noeud);
    if (element !== undefined) {
      saisies.set(chemin, valeurNeuveDe(element) !== undefined || choixDuNoeud(element) ? 'ajouter' : 'json');
      if (!vus.has(element)) champ({ ...champDeLElement(f, 0), contexte: f.contexte }, `${chemin}/0`);
      return;
    }
    const record = recordDuNoeud(f.noeud);
    if (record && champsDuRecord(f, {}, []).length) return champ({ ...f, key: '{}', kind: kindDuNoeud('', record.valeur), noeud: record.valeur }, `${chemin}/{}`);
    const formes = ouverts([f.noeud]).filter((n) => champsDeclares(n));
    feuille(f, chemin);
    formes.forEach((n, i) => objet(n, f, `${chemin}{${i}}`));
  }
  const vide = emptyScene('s', 4, 4);
  const porteurs = [
    ['zone', zone()],
    ['declencheur', declencheur()],
    ['entite', { kind: 'personnage', id: 'p', pos: { x: 0, y: 0 }, vehicule: { id: 'x' } }],
    ['entite', { kind: 'prop', id: 'd', ref: 'x', pos: { x: 0, y: 0 }, usable: { actions: [{ id: 'a' }] } }],
    ['dialogue', DIALOGUE],
    ['rencontre', RENCONTRE],
  ] as const;
  for (const [sorte, donnee] of porteurs) for (const f of formulaireDe(sorte, donnee as never, { ...CADRE_VIDE, scene: vide })) champ(f, `${sorte}/${f.key}`);
  return saisies;
}

describe('chaque feuille des formulaires tirés du schéma a un contrôle typé (#3606 M2e)', () => {
  const saisies = saisiesDesFormulaires();

  it('le sélecteur de héros, la fenêtre de Détermination, l’échéance d’un modificateur de navire, la cible d’un effet et d’un effet déclenché se choisissent par variante nommée, les fragments d’une adresse de prose s’ajoutent et se choisissent de même', () => {
    const effets = ['setObjective', 'journal', 'grantFavor'].map((type) => `declencheur/flow<kind=effet>/effet<type=${type}>/descRef/parts`);
    const attendues: Record<string, string> = Object.fromEntries([
      ...['partyDead', 'skill', 'talent', 'career', 'species', 'status'].map((kind) => [`zone/crossTest/gate<kind=${kind}>/who`, 'variantes']),
      ['zone/onCross/0<op=condition>/resolveWindow', 'variantes'],
      ['zone/onCross/0<op=navireMod>/jusqua', 'variantes'],
      ...['infestation>/chaqueNuit<kind=effet>/effet', 'augmentWeapon>/onHitEffects/0', 'grantWeapon>/onHitEffects/0'].map((op) => [`zone/onCross/0<op=${op}/on`, 'variantes']),
      ...effets.flatMap((parts) => [[parts, 'ajouter'], [`${parts}/0`, 'variantes']]),
    ]);
    expect(Object.keys(attendues)).toHaveLength(17);
    expect(tableTotale(Object.keys(attendues), (c) => saisies.get(c))).toEqual(attendues);
    const horsObjet = ['zone/crossTest/gate<kind=partyDead>/who', 'zone/onCross/0<op=condition>/resolveWindow', 'zone/onCross/0<op=navireMod>/jusqua', 'zone/onCross/0<op=augmentWeapon>/onHitEffects/0/on'];
    expect(horsObjet.map((c) => saisies.get(`${c}<forme=0>`)), 'la variante hors objet se choisit parmi ses valeurs').toEqual(horsObjet.map(() => 'choix'));
  });

  it('se saisissent encore en JSON EXACTEMENT : les rencontres d’une bataille rangée, et chaque op non typée', () => {
    expect([...saisies].filter(([, s]) => s === 'json').map(([c]) => c).sort()).toEqual([
      'declencheur/flow<kind=effet>/effet<type=startMassBattle>/battle/sceneEncounters',
      ...OPS_NON_TYPEES.map((op) => `zone/onCross/0<op=${op}>`),
    ].sort());
  });
});

describe('l’accès d’un porteur à son document du projet (#3606)', () => {
  const MURS = [{ x: 1, y: 2, side: 'N' as const }, { x: 3, y: 0, side: 'E' as const, z: 1 }];
  const SCENE: Scene = { ...emptyScene('salle', 4, 4), walls: MURS };
  const CARTE: WorldMap = { ...emptyWorldMap('carte'), routes: [{ id: 'route', a: { id: 'x' }, b: { id: 'y' }, km: 1, modes: ['pied'] }] };
  const projet = (worldMap?: WorldMap) => ({ scenes: [SCENE], narratif: NARRATIF_VIDE, ...(worldMap ? { worldMap } : {}) }) as unknown as ProjetDEdition;
  type Route = WorldMap['routes'][number];
  type Mur = NonNullable<Scene['walls']>[number];
  const ROUTES: AccesDuPorteur<Route> = { document: 'carte', collection: 'routes' };
  const LA_CARTE: AccesDuPorteur<WorldMap> = { document: 'carte' };

  it('un porteur de collection s’identifie par la clé que le schéma de son document déclare à la collection', () => {
    const murs: AccesDuPorteur<Mur> = { document: 'scene', collection: 'walls' };
    expect(porteurDuProjet<Mur>(murs, projet(), 'salle', '3,0,E,1')).toEqual({ donnee: MURS[1], chemin: ['walls', 1] });
    const plein = { ...MURS[0], kind: 'door' as const };
    expect(projetAvecLePorteur<Mur>(murs, projet(), 'salle', MURS[0], plein).scenes[0].walls).toEqual([plein, MURS[1]]);
  });

  it('un porteur d’un document absent du projet n’a aucun porteur ; présent, ceux de sa collection', () => {
    expect([porteursDuProjet<Route>(ROUTES, projet(), 'salle'), porteursDuProjet<WorldMap>(LA_CARTE, projet(), 'salle')]).toEqual([[], []]);
    expect(porteursDuProjet<Route>(ROUTES, projet(CARTE), 'salle')).toEqual(CARTE.routes);
  });

  it('le porteur singulier d’un document est le document, identifié par lui, au chemin vide ; le narratif, sans identifiant, en est un', () => {
    expect(porteurDuProjet<WorldMap>(LA_CARTE, projet({ ...CARTE, id: 'autre' }), 'salle', 'carte')).toEqual({ donnee: { ...CARTE, id: 'autre' }, chemin: [] });
    const renommee = { ...CARTE, label: 'Le Reikland' };
    const ecrit = projetAvecLePorteur<WorldMap>(LA_CARTE, projet(CARTE), 'salle', CARTE, renommee);
    expect([ecrit.worldMap, ecrit.scenes[0]]).toEqual([renommee, SCENE]);
    type Narratif = ProjetDEdition['narratif'];
    const LE_NARRATIF: AccesDuPorteur<Narratif> = { document: 'narratif' };
    expect([porteurDuProjet<Narratif>(LE_NARRATIF, projet(), 'salle', 'narratif'), porteurDuProjet<Narratif>(LE_NARRATIF, projet(), 'salle', 'salle')]).toEqual([{ donnee: NARRATIF_VIDE, chemin: [] }, undefined]);
    const enrichi = { ...NARRATIF_VIDE, presetsPnj: [] };
    expect(projetAvecLePorteur<Narratif>(LE_NARRATIF, projet(), 'salle', NARRATIF_VIDE, enrichi).narratif).toBe(enrichi);
    expect([porteurDeLaSel(null, 'scene', 'salle'), porteurDeLaSel(null, 'narratif', 'salle')], 'sans sélection, le singulier du document ouvert ; le narratif n’en porte aucun').toEqual([{ sorte: 'scene', id: 'salle' }, undefined]);
  });
});

describe('les porteurs de la carte du monde : lieu, route et carte (#3606 M5)', () => {
  const SALLE: Scene = { ...emptyScene('salle', 4, 4), entryPoints: { porte: { x: 0, y: 0 } } };
  const POI = { id: 'temple', label: 'Temple', pos: { x: 1, y: 1 }, serviceKind: { id: 'auberge' } };
  const CARTE: WorldMap = {
    ...emptyWorldMap('monde'),
    places: [{ id: 'x', label: 'X', pos: { x: 20, y: 20 }, scene: { id: 'salle' }, poi: [POI] }, { id: 'y', label: 'Y', pos: { x: 60, y: 20 }, scene: { id: 'salle' } }],
    routes: [{ id: 'r', a: { id: 'x' }, b: { id: 'y' }, km: 1, modes: ['pied'] }],
  };
  const projet = { scenes: [SALLE], narratif: NARRATIF_VIDE, worldMap: CARTE } as unknown as ProjetDEdition;
  const cadre: CadreDuPorteur = { scene: SALLE, projet, source: { manifeste: null, chapitres: {} } };
  const cles = (fs: FieldDesc[]) => fs.map((f) => f.key);

  it('une sélection d’un lieu ou d’une route désigne son porteur ; sans sélection, la carte ouverte désigne la carte', () => {
    expect([porteurDeLaSel({ type: 'place', id: 'x' }, 'carte', 'salle'), porteurDeLaSel({ type: 'route', id: 'r' }, 'scene', 'salle'), porteurDeLaSel(null, 'carte', 'salle')])
      .toEqual([{ sorte: 'lieu', id: 'x' }, { sorte: 'route', id: 'r' }, { sorte: 'carte', id: 'carte' }]);
  });

  it('le lieu offre chaque champ de son schéma hors de son identifiant, de sa position et de la liste de ses points d’intérêt, dont il offre les champs hors identifiant et position', () => {
    expect(cles(formulaireDe('lieu', CARTE.places[0], cadre))).toEqual(['label', 'scene', 'entry', 'icon', 'port', 'market', 'services', 'backdrop', 'when', 'couvre', 'prose', 'source', 'adapteDe', 'poi']);
    const lieu = CARTE.places[0];
    expect([['poi', 0, 'label'], ['poi', 0, 'pos'], ['poi', 0, 'id'], ['poi']].map((c) => avecLaValeurDuPorteur('lieu', lieu, c as Segment[], c[2] === 'label' ? 'Chapelle' : { x: 2, y: 2 }, cadre).ok)).toEqual([true, false, false, false]);
  });

  it('la route offre chaque champ de son schéma hors de son identifiant, de ses extrémités et de son sens ; la carte, son libellé, son fond et ses réglages', () => {
    expect(cles(formulaireDe('route', CARTE.routes[0], cadre))).toEqual(['km', 'modes', 'billets', 'speed', 'perilDie', 'perils', 'ambush', 'inns', 'sea', 'seaHeading', 'river', 'riverPerils', 'when', 'refus', 'riverExposure', 'couvre', 'provenances']);
    expect(cles(formulaireDe('carte', CARTE, cadre))).toEqual(['label', 'background', 'params']);
  });

  it('les choix d’un porteur restreignent ceux d’une référence locale : le départ d’un billet d’une route à sens unique, son seul lieu de départ, parmi les lieux de la carte', () => {
    const sensUnique = { ...CARTE.routes[0], from: { id: 'y' }, modes: ['pied', 'diligence'], billets: { diligence: { prix: {}, depuis: { id: 'y' } } } };
    expect(choixDuChamp('route', sensUnique, ['billets', 'diligence', 'depuis'], cadre)?.map((c) => [c.valeur, c.libelle])).toEqual([[{ id: 'y' }, 'Y']]);
    const horsCarte = { ...sensUnique, from: { id: 'w' } };
    expect(choixDuChamp('route', horsCarte, ['billets', 'diligence', 'depuis'], cadre), 'un départ que la carte n’a pas ne s’offre pas').toEqual([]);
  });

  it('un avertissement de la carte désigne le lieu ou la route qui porte son élément ; sans élément, la carte ; un point d’intérêt, aucun porteur', () => {
    expect([porteurDeLaPortee('worldMap', 'x', projet, 'salle'), porteurDeLaPortee('worldMap', 'r', projet, 'salle'), porteurDeLaPortee('worldMap', undefined, projet, 'salle'), porteurDeLaPortee('worldMap', 'temple', projet, 'salle')])
      .toEqual([{ sorte: 'lieu', id: 'x' }, { sorte: 'route', id: 'r' }, { sorte: 'carte', id: 'carte' }, undefined]);
  });
});
