import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { nommerChamps, metaDesChamps, nommerNoeud, nomDeNoeud, type MetaDesChamps } from './meta';
import { cheminLisible, DEFS_DE_DOCUMENT, lieuDe, validateDocument } from '../validate';
import { sceneSchema, restPlacesSchema } from '../defs-scenes/scene';
import { proseNommee, declarationProseNommee } from './prose';
import { mesurerCheminsNommes } from '../../../../scripts/guards/lib/cheminsNommes.mts';
import { emptyScene } from '../../../state/scene';
import { emptyNarratif } from '../../../state/campaignNarratif';
import { parseProject, ProjetRefuse } from '../../../state/worldMap';
import { validateScene } from '../../../state/validateScene';
import { refusDeLaPorteDuProjet } from '../../../ui/editor/ProjectModals';
import { gameOpSchema } from './mecanique';
import { listeCle } from './collection-cle';
import { document } from './document';
import { defDe, ouverts } from './descente';
import { fragmentBlocsSchema, fragmentCelluleSchema, descRefSchema, castingNumberModSchema, detailRecipeSchema, combatFeatureSchema } from './valeurs';
import { effectSchema, libelleEffet } from '../defs-scenes/effets';
import { placeServiceSchema } from '../defs-scenes/worldmap';

const sceneJouet = () => {
  const scene = emptyScene(4, 4);
  scene.id = 'scene-jouet';
  scene.entities.push({ id: 'départ', kind: 'heroStart', pos: { x: 1, y: 1 } });
  return scene;
};
const projetJouet = () => ({ type: 'projet', id: 'jouet', label: 'Jouet', versionContenu: 1, maison: 'fixture', narratif: emptyNarratif(), scenes: [sceneJouet()] });

describe('chemins nommés par leur schéma', () => {
  it('couvre tous les objets atteints, charges dynamiques comprises', () => {
    const mesure = mesurerCheminsNommes(DEFS_DE_DOCUMENT.map(def => def.schema));
    console.log(JSON.stringify({ objets: mesure.objets, champs: mesure.champs, fautes: mesure.fautes }));
    expect(mesure.fautes).toEqual([]);
    expect(DEFS_DE_DOCUMENT.length).toBeGreaterThanOrEqual(128);
    expect(mesure.objets).toBeGreaterThanOrEqual(1123);
    expect(mesure.champs).toBeGreaterThanOrEqual(5937);
    expect(mesure.chemins.some(c => c.includes('^'))).toBe(true);
    expect(mesure.chemins.some(c => c.includes('profil'))).toBe(true);
  });
  it('nomme un champ absent par son parent', () => {
    const schema = nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte attendu' } });
    expect(cheminLisible(lieuDe(schema, {}, ['texte']))).toBe('texte attendu');
  });
  it('refuse les métas absentes et orphelines', () => {
    expect(() => nommerChamps(z.strictObject({ texte: z.string() }), {} as never)).toThrow('texte');
    expect(() => nommerChamps(z.strictObject({}), { texte: { label: 'texte' } } as never)).toThrow('texte');
  });
  it('rend un total seulement lorsque la lecture exige les métas', () => {
    const schema = nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte attendu' } });
    expectTypeOf(metaDesChamps(schema)).toEqualTypeOf<MetaDesChamps<typeof schema.shape> | undefined>();
    expectTypeOf(metaDesChamps(schema, { exigees: true })).toEqualTypeOf<MetaDesChamps<typeof schema.shape>>();
    expect(metaDesChamps(schema, { exigees: true })).toEqual({ texte: { label: 'texte attendu' } });
  });
  it('refuse les métas exigées perdues par clone ou remplacées', () => {
    const schema = nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte attendu' } });
    for (const sansMetas of [z.strictObject({ texte: z.string() }), schema.clone(defDe(schema) as Parameters<typeof schema.clone>[0]), schema.meta({ champs: undefined })]) {
      expect(metaDesChamps(sansMetas)).toBeUndefined();
      expect(() => metaDesChamps(sansMetas, { exigees: true })).toThrow('métas de champs absentes');
    }
  });
  it('contrôle les champs manquants, vides et orphelins en lecture exigée', () => {
    const schema = nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte attendu' } });
    for (const champs of [{}, { texte: { label: ' ' } }, { texte: { label: 'texte attendu' }, autre: { label: 'autre' } }]) {
      const remplace = schema.meta({ champs });
      expect(metaDesChamps(remplace)).toEqual(champs);
      expect(() => metaDesChamps(remplace, { exigees: true })).toThrow();
    }
  });
  it('porte le journal récursif, sans traduction locale', () => {
    const scene = { type: 'scene', id: 's', label: 'Scène', dimensions: { w: 1, h: 1 }, tiles: [], entities: [], triggers: [{ id: 'trig-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'journal', desc: '' } }] } }] };
    const faute = validateDocument(sceneSchema, scene)?.find(f => f.chemin[f.chemin.length - 1] === 'desc');
    expect(faute).toBeDefined();
    expect(cheminLisible(faute!.lieu)).toBe('déclencheur « trig-0 » › étape 1 › effet Journal › texte');
  });
  const journalVide = () => ({ kind: 'do', effect: { type: 'journal', desc: '' } });
  const lieuxDeJournaux = (flow: unknown) => {
    const scene = { type: 'scene', id: 's', label: 'Scène', dimensions: { w: 1, h: 1 }, tiles: [], entities: [], triggers: [{ id: 'trig-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow }] };
    const fautes = validateDocument(sceneSchema, scene)!.filter(f => f.chemin[f.chemin.length - 1] === 'desc');
    expect(fautes).toHaveLength(2);
    return fautes.map(f => cheminLisible(f.lieu));
  };
  it('distingue les deux branches conditionnelles des vrais Journal vides', () => {
    const lieux = lieuxDeJournaux({ kind: 'if', cond: { kind: 'always' }, then: journalVide(), else: journalVide() });
    expect(lieux).toEqual(['déclencheur « trig-0 » › alors › effet Journal › texte', 'déclencheur « trig-0 » › sinon › effet Journal › texte']);
  });
  it('distingue les deux réponses de choix des vrais Journal vides', () => {
    const lieux = lieuxDeJournaux({ kind: 'choice', prompt: 'Choisir', yes: journalVide(), no: journalVide() });
    expect(lieux).toEqual(['déclencheur « trig-0 » › oui › effet Journal › texte', 'déclencheur « trig-0 » › non › effet Journal › texte']);
  });
  it('conserve la déclaration de prose composée', () => {
    const schema = proseNommee(nommerChamps(z.strictObject({ id: z.string() }), { id: { label: 'identifiant' } }), 'narratif.documents[].prose');
    expect(declarationProseNommee(schema)).toBeDefined();
    expect(metaDesChamps(schema)).toMatchObject({ id: { label: 'identifiant' }, prose: { label: 'texte' }, source: { label: 'source' } });
  });

  it('nomme les listes sans clé et celles dont la clé manque', () => {
    const enfant = nommerNoeud(nommerChamps(z.strictObject({ id: z.string(), texte: z.string() }), { id: { label: 'identifiant' }, texte: { label: 'texte' } }), { element: 'réponse' });
    const simple = nommerChamps(z.strictObject({ choix: z.array(enfant) }), { choix: { label: 'réponses' } });
    const cle = nommerChamps(z.strictObject({ choix: listeCle(enfant, 'id') }), { choix: { label: 'réponses' } });
    for (const schema of [simple, cle]) expect(cheminLisible(lieuDe(schema, { choix: [{}] }, ['choix', 0, 'texte']))).toBe('réponse 1 › texte');
    expect(cheminLisible(lieuDe(cle, { choix: [{ id: 'r-1' }] }, ['choix', 0, 'texte']))).toBe('réponse « r-1 » › texte');
  });
  it('garde une enveloppe fautive, masque seulement une enveloppe intermédiaire', () => {
    const schema = nommerChamps(z.strictObject({ flow: nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte' } }) }), { flow: { label: 'enchaînement', transparent: true } });
    expect(cheminLisible(lieuDe(schema, {}, ['flow']))).toBe('enchaînement');
    expect(cheminLisible(lieuDe(schema, {}, ['flow', 'texte']))).toBe('texte');
    expect(cheminLisible(lieuDe(schema, {}, ['clé-étrangère']))).toBe('champ inconnu « clé-étrangère »');
    const variantes = z.union([schema, nommerChamps(z.strictObject({ flow: schema.shape.flow }), { flow: { label: 'enchaînement' } })]);
    expect(cheminLisible(lieuDe(variantes, {}, ['flow', 'texte']))).toBe('enchaînement › texte');
  });
  it('reprend le sens des noms au propriétaire des champs', () => {
    for (const [schema, chemin, nom] of [
      [descRefSchema, ['ch'], 'chapitre'],
      [fragmentBlocsSchema, ['sum'], 'empreinte'],
      [fragmentCelluleSchema, ['sum'], 'empreinte'],
      [castingNumberModSchema, ['round'], 'arrondi'],
      [detailRecipeSchema, ['courses'], 'rangs'],
      [restPlacesSchema, ['maison'], 'chez soi'],
      [sceneSchema, ['rest', 'maison'], 'repos › chez soi'],
      [placeServiceSchema, ['rest', 'maison'], 'repos › chez soi'],
    ] as const) expect(cheminLisible(lieuDe(schema, {}, chemin))).toBe(nom);
    for (const cle of ['focusNoMiscastOnDouble', 'castNoMiscastOnDouble']) {
      expect(cheminLisible(lieuDe(combatFeatureSchema, {}, [cle]))).toMatch(/^aucune Imparfaite sur un double réussi /);
    }
  });
  it('dérive chaque nom d’effet de son titre court propriétaire', () => {
    const noeuds = ouverts([effectSchema], {}).filter(noeud => defDe(noeud)?.type === 'object');
    expect(noeuds.length).toBeGreaterThanOrEqual(58);
    for (const noeud of noeuds) {
      const meta = nomDeNoeud(noeud)!;
      expect(meta.label).toBeTruthy();
      expect(meta.nom).toBe(`effet ${meta.label}`);
      expect(meta.label).not.toMatch(/\b(?:LDB|ADE|MDG|MSRC|NADJ|handout|flag|buff|custom)\b|#\d|[()]/i);
    }
    expect(libelleEffet('journal')).toBe('Journal');
  });
  it('ne choisit pas une variante arbitraire sans discriminant', () => {
    const variante = (type: 'a' | 'b', nom: string) => nommerChamps(z.strictObject({ type: z.literal(type), value: z.string() }), { type: { label: 'type' }, value: { label: nom } });
    const schema = nommerNoeud(z.discriminatedUnion('type', [variante('a', 'premier texte'), variante('b', 'second texte')]), { nom: 'texte commun' });
    for (const valeur of [{}, { type: 'invalide' }]) {
      expect(cheminLisible(lieuDe(schema, valeur, ['type']))).toBe('type');
      expect(cheminLisible(lieuDe(schema, valeur, ['value']))).toBe('texte commun');
    }
    expect(cheminLisible(lieuDe(schema, { type: 'b' }, ['value']))).toBe('second texte');
  });
  it('retrouve les vraies charges imbriquées des opérations', () => {
    const donnee = { op: 'transform', tag: 'transformation', ops: [{ op: 'heal' }] };
    const fautes = validateDocument(gameOpSchema, donnee)!;
    expect(fautes).toHaveLength(1);
    expect(fautes[0].chemin).toEqual(['ops', 0, 'amount']);
    expect(cheminLisible(fautes[0].lieu)).toBe('opérations 1 › quantité');
  });
  it('repose les noms après composition et les traverse sous les enveloppes', () => {
    const noms = { texte: { label: 'texte' } };
    const original = nommerChamps(z.strictObject({ texte: z.string() }), noms);
    const etendu = nommerChamps(original.extend({ suite: z.string() }), { ...metaDesChamps(original, { exigees: true }), suite: { label: 'suite' } });
    const partiel = nommerChamps(original.partial(), noms);
    const affine = nommerChamps(original.superRefine(() => {}), noms);
    for (const schema of [etendu, partiel, affine, original.optional(), z.lazy(() => original), original.pipe(z.transform(v => v))]) {
      expect(cheminLisible(lieuDe(schema, undefined, ['texte']))).toBe('texte');
    }
    const doc = document('jouet', 'config', { contenu: original }, { contenu: { label: 'contenu' } }, { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'fixture de test sans exposition' } }, edit: { none: 'fixture' } });
    for (const schema of [doc.entree, doc.entreePartielle]) expect(cheminLisible(lieuDe(schema, {}, ['contenu', 'texte']))).toBe('contenu › texte');
  });
  it('reprend les noms des seuls champs republiables dans la variante finale', () => {
    const doc = document('jouet', 'config', { contenu: z.string(), autre: z.number() }, { contenu: { label: 'texte republié' }, autre: { label: 'autre quantité' } }, { codex: { exempt: { kind: 'vocabulaire-app-interne', raison: 'fixture de test sans exposition' } }, edit: { none: 'fixture' } }, { variantes: ['contenu'] });
    for (const schema of [doc.entree, doc.entreePartielle]) {
      expect(cheminLisible(lieuDe(schema, {}, ['variants', 0, 'contenu']))).toBe('Variantes 1 › texte republié');
      expect(cheminLisible(lieuDe(schema, {}, ['variants', 0, 'when']))).toBe('Variantes 1 › condition');
      expect(mesurerCheminsNommes([schema]).fautes).toEqual([]);
    }
    const base = { type: 'jouet', id: 'jouet', label: 'Jouet', maison: 'fixture', contenu: 'texte', autre: 1 };
    expect(doc.entree.safeParse({ ...base, variants: [{ when: { rule: 'r' } }] }).success).toBe(true);
    expect(doc.entree.safeParse({ ...base, variants: [{ when: { rule: 'r' }, autre: 2 }] }).success).toBe(false);
    expect(doc.entree.safeParse({ ...base, variants: [{ contenu: 'texte' }] }).success).toBe(false);
  });
  it.each(['journal', 'réplique', 'stade'] as const)('refus canonique %s', cas => {
    const projet = projetJouet();
    const scene = projet.scenes[0];
    if (cas === 'journal') scene.triggers.push({ id: 'trig-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'journal', desc: '' } }] } });
    if (cas === 'réplique') scene.dialogues.push({ id: 'dialogue-0', start: 'node-0', nodes: [{ id: 'node-0', desc: '', choices: [] }] });
    if (cas === 'stade') {
      projet.narratif.affaires.push({ id: 'affaire-0', titre: 'Affaire' });
      projet.narratif.indices.push({ id: 'indice-0', affaireId: 'affaire-0', kind: 'indice', titre: 'Indice', stades: [{ id: 'stade-0' }] });
    }
    let refus: ProjetRefuse | undefined;
    try { parseProject(projet); } catch (erreur) { if (!(erreur instanceof ProjetRefuse)) throw erreur; refus = erreur; }
    expect(refus).toBeDefined();
    const message = refusDeLaPorteDuProjet(refus!, 'enregistrement').message;
    expect(message).toContain(cas === 'stade' ? 'stade « stade-0 »' : 'texte');
    expect(message).not.toMatch(/flow|steps|\.desc|\.prose/);
    const sceneWarnings = validateScene(projet.scenes);
    if (cas === 'journal') expect(sceneWarnings).toContainEqual(expect.objectContaining({ scope: 'trigger', refId: 'trig-0', message: expect.stringContaining('étape 1 › effet Journal › texte') }));
    if (cas === 'réplique') expect(sceneWarnings).toContainEqual(expect.objectContaining({ scope: 'dialogue', refId: 'dialogue-0', message: expect.stringContaining('nœud « node-0 » › réplique') }));
    if (cas === 'stade') expect(refus!.fautes.some(f => cheminLisible(f.lieu).includes('stade « stade-0 »'))).toBe(true);
  });
});
