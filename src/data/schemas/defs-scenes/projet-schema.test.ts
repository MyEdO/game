/**
 * Contrat du schéma de PROJET DE SCÈNE (#1466 T3-a) — la porte UNIQUE du seam `parseProject`, qui a
 * remplacé les quatre validateurs manuscrits. On y verrouille, sur un projet-JOUET minimal :
 *  - la FORME reçue par le seam, AVANT `normalizeScene`/`resolvePortRef` (collections absentes,
 *    port SPARSE `{ref}`) — VERTE, sinon le schéma refuserait un document que l'app charge ;
 *  - les sémantiques, chacune ROUGE avec le CHEMIN et l'id fautif : FK `activeAxes`, invariants du
 *    narratif, FK intra-document `presetId` ;
 *  - l'ENVELOPPE que la fabrique `document()` pose depuis #1552 : le `type` du document et celui de
 *    chaque scène embarquée, l'IDENTITÉ requise (`id`/`label`/`versionContenu`) et la PROVENANCE
 *    (`source` ∨ `maison`) ;
 *  - le `schema` littéral courant (un document non migré n'entre pas par cette porte).
 */
import { describe, it, expect } from 'vitest';
import { projetSchema, projetDoc } from './projet';
import { PENTE_TOIT_DEG } from './scene';
import { narratifSchema } from './narratif';
import { schema as catalogueDesObjets } from '../defs/trappings';
import { schema as bestiaire } from '../defs/creatures';
import { findCreatureById } from '../../index';
import { noeudsAuChemin } from '../grammaire/descente';
import { parseProject } from '../../../noyau/worldMap';
import { choixDuNoeud } from '../../../noyau/codex/editFields';
import { renommeAuProjet, retireDuProjet } from '../../../noyau/narratifEdit';
import { cheminLisible, validateDocument } from '../validate';
import { versDisque } from '../grammaire/prose';
import diligenceProjet from '../../../scenes/diligence/diligence-projet.json';
import { emptyNarratif } from '../../../noyau/monde/campaignNarratif';
import { objetDeCampagne } from '../../../scenes/fixtures/objetDeCampagne.testkit';
import { declarationDeFeuilleDId, mesureDuParse } from '../grammaire/ref';
import { sitesDeLaPortee } from '../grammaire/collection-cle';
import { OBJETS_DU_PROJET } from '../grammaire/valeurs';
import { SCENES_DU_PROJET } from './communs';

type Jouet = Record<string, unknown>;

const sceneMinimale = (over: Jouet = {}): Jouet => ({
  type: 'scene',
  id: 'scene-1',
  label: 'Une salle',
  desc: 'Scène minimale de fixture.',
  dimensions: { w: 4, h: 4 },
  // EXIGÉ (#1691) : la matière de chaque partie de relief vient de la scène, le rendu n'en devine
  // aucune — une scène qui n'en porte pas est refusée ici même.
  reliefDefaults: { cliff: { id: 'terre' }, ramp: { id: 'terre' }, deck: { id: 'pierre' }, pilier: { id: 'pilier' } },
  // EXIGÉE (#1715) : la couverture, la pente de référence et la borne de comble des toitures
  // dérivées viennent de la scène — même refus nominatif si elle manque.
  roofDefaults: { material: { id: 'toit-ardoise' }, pitchDeg: 45, riseMaxStoreys: 1 },
  ...over,
});

/** Projet-JOUET au format COURANT : l'enveloppe exige le `type`, l'identité et la provenance. */
const projet = (over: Jouet = {}): Jouet => ({
  type: 'projet',
  id: 'projet-jouet',
  label: 'Projet jouet',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne publie ce projet-jouet',
  narratif: emptyNarratif(),
  scenes: [sceneMinimale()],
  ...over,
});

/** Le document PRIVÉ d'une clé — l'exigence de l'enveloppe se MESURE par amputation. */
const sans = (cle: string, over: Jouet = {}): Jouet => {
  const doc = projet(over);
  delete doc[cle];
  return doc;
};

/** LIEU + message des fautes, tels que la porte les rend (`validateDocument`) : l'erreur NOMME le
 *  fautif par son lieu, jamais par un préfixe recopié dans son message. */
const fautes = (valeur: unknown, schema: typeof projetSchema | typeof narratifSchema = projetSchema) => {
  const trouvees = validateDocument(schema, valeur);
  expect(trouvees).not.toBeNull();
  return (trouvees ?? []).map((f) => `${cheminLisible(f.lieu)} :: ${f.message}`);
};

/**
 * Chemin + CODE d'issue + la donnée que l'issue NOMME (clé en trop, options attendues, borne). C'est
 * la forme STABLE d'un refus de la dépendance : le `message`, lui, appartient à la locale FR
 * (`src/lib/zodEnFrancais.ts`) et rote à chaque montée de zod. `fautes` reste la porte des messages
 * MAISON, que le dépôt écrit et tient.
 */
const fautesCodees = (valeur: unknown, schema: typeof projetSchema = projetSchema) => {
  const res = schema.safeParse(valeur);
  expect(res.success).toBe(false);
  return res.success ? [] : res.error.issues.map((i) => {
    const brut = i as unknown as Record<string, unknown>;
    const nommee = brut.keys ?? brut.values ?? brut.maximum ?? brut.minimum;
    return `${i.path.join('.')} :: ${i.code}${nommee === undefined ? '' : ` ${JSON.stringify(nommee)}`}`;
  });
};

describe('apparence des objets de campagne', () => {
  type Surface = 'action' | 'op' | 'apparencesObjets';
  const objet = objetDeCampagne({ id: 'hache-du-projet', label: 'Hache du projet', shape: { id: 'hache' }, formChoices: ['hache'] });
  /** Le coffre qui référence `apparence` par la `surface` donnée : action directe, op, ou apparence d'entité. */
  const coffre = (surface: Surface, apparence: string): Jouet => {
    const lieu = { id: 'coffre', kind: 'prop', decor: { id: 'coffre' }, pos: { x: 1, y: 1 } };
    if (surface === 'apparencesObjets') return { ...lieu, appearance: { apparencesObjets: { [objet.id]: { id: apparence } } } };
    const don = { trappingId: objet.id, apparence: { id: apparence } };
    const effect = surface === 'action' ? { type: 'giveTrapping', ...don } : { type: 'ops', ops: [{ op: 'giveTrapping', ...don }] };
    return { ...lieu, usable: { actions: [{ id: 'fouiller', flow: { kind: 'effet', effet: effect } }] } };
  };
  const document = (apparence: string, { surface = 'action', registre = {} }: { surface?: Surface; registre?: Jouet } = {}) => projet({
    narratif: { ...emptyNarratif(), objets: [{ ...objet, ...registre }] },
    scenes: [sceneMinimale({ entities: [coffre(surface, apparence)] })],
  });
  it('le document juge la référence donnée avec ses propres objets', () => {
    const result = projetSchema.safeParse(document('hache_naine'));
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });
  it.each<Surface>(['op', 'apparencesObjets'])('%s emploie aussi les objets du document', (surface) => {
    const result = projetSchema.safeParse(document('hache_naine', { surface }));
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
    expect(projetSchema.safeParse(document('cape', { surface })).success).toBe(false);
  });
  it('la forme du registre narratif compose la référence fermée du catalogue', () => {
    for (const shape of ['hache', { id: 'forme-inconnue' }]) {
      expect(projetSchema.safeParse(document('hache_naine', { registre: { shape } })).success, JSON.stringify(shape)).toBe(false);
    }
    expect(projetSchema.safeParse(document('hache_naine', { registre: { formChoices: ['forme-inconnue'] } })).success).toBe(false);
  });
  it('une apparence étrangère reste refusée et nomme les deux ids', () => {
    expect(fautes(document('cape')).join('\n')).toContain('hache-du-projet');
    expect(fautes(document('cape')).join('\n')).toContain('cape');
  });
});

describe('portée des objets du projet (`OBJETS_DU_PROJET`) : catalogue ∪ `narratif.objets`', () => {
  const objet = objetDeCampagne();
  const DU_CATALOGUE = 'arme-simple';
  /** Le projet qui référence `id` aux quatre positions : Effet et GameOp `giveTrapping`, clé `apparencesObjets` d'une
   *  entité et d'un PNJ précomposé. */
  const document = (id: string) => projet({
    narratif: { ...emptyNarratif(), objets: [objet], presetsPnj: [{ id: 'pnj-de-sonde', base: { id: 'gobelin' }, apparence: { apparencesObjets: { [id]: { id: 'epee' } } } }] },
    scenes: [sceneMinimale({ entities: [
      { id: 'coffre', kind: 'prop', decor: { id: 'coffre' }, pos: { x: 1, y: 1 }, usable: { actions: [
        { id: 'fouiller', flow: { kind: 'effet', effet: { type: 'giveTrapping', trappingId: id } } },
        { id: 'ouvrir', flow: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'giveTrapping', trappingId: id }] } } },
      ] } },
      { id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 2 }, appearance: { apparencesObjets: { [id]: { id: 'epee' } } } },
    ] })],
  });
  const POSITIONS = [
    ['scenes.0.entities.0.usable.actions.0.flow.effet.trappingId', false],
    ['scenes.0.entities.0.usable.actions.1.flow.effet.ops.0.trappingId', false],
    [`scenes.0.entities.1.appearance.apparencesObjets.${'@'}`, true],
    [`narratif.presetsPnj.0.apparence.apparencesObjets.${'@'}`, true],
  ] as const;
  /** Les repères du parse de mesure vers `id`, aux quatre positions. */
  const reperesVers = (id: string) =>
    mesureDuParse(projetSchema, document(id)).reperes
      .filter((r) => POSITIONS.some(([chemin]) => r.path.join('.') === chemin.replace('@', id)))
      .map((r) => [r.path.join('.'), r.type, r.parCle])
      .sort();

  it('un objet de la campagne : le projet parse, et chaque position rend un repère LOCAL (`parCle` pour les clés)', () => {
    const r = projetSchema.safeParse(document(objet.id));
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
    expect(reperesVers(objet.id)).toEqual(POSITIONS.map(([chemin, parCle]) => [chemin.replace('@', objet.id), 'local:narratif.objets', parCle]).sort());
  });

  it('un id du catalogue : repère du type `trapping`, comme hors portée', () => {
    expect(reperesVers(DU_CATALOGUE)).toEqual(POSITIONS.map(([chemin, parCle]) => [chemin.replace('@', DU_CATALOGUE), 'trapping', parCle]).sort());
  });

  it('un id ni au catalogue ni dans la campagne est refusé au parse, à son chemin', () => {
    const doc = document(objet.id) as { scenes: { entities: { usable?: { actions: { flow: { effet: { trappingId?: string } } }[] } }[] }[] };
    doc.scenes[0].entities[0].usable!.actions[0].flow.effet.trappingId = 'objet-fantome';
    expect(fautes(doc)).toEqual([
      'scène « scene-1 » › entité « coffre » › utilisable › actions « fouiller » › effet Donner un objet › objet :: « objet-fantome » est absent du catalogue des objets de la campagne (collection « narratif.objets » du document).',
    ]);
  });

  it('une clé d’apparence par objet ni au catalogue ni dans la campagne est refusée au parse, à sa clé', () => {
    const doc = document(objet.id) as { scenes: { entities: { appearance?: { apparencesObjets: Record<string, unknown> } }[] }[] };
    doc.scenes[0].entities[1].appearance!.apparencesObjets = { 'objet-fantome': { id: 'epee' } };
    const r = projetSchema.safeParse(doc);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`)).toEqual([
      'scenes.0.entities.1.appearance.apparencesObjets.objet-fantome :: « objet-fantome » est absent du catalogue des objets de la campagne (collection « narratif.objets » du document).',
    ]);
  });

  it('un objet de la campagne donné avec une apparence qu’il n’admet pas : refusé avec le message d’apparence', () => {
    const doc = document(objet.id) as { scenes: { entities: { usable?: { actions: { flow: { effet: Record<string, unknown> } }[] } }[] }[] };
    doc.scenes[0].entities[0].usable!.actions[0].flow.effet.apparence = { id: 'cape' };
    const r = projetSchema.safeParse(doc);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`)).toEqual([
      `scenes.0.entities.0.usable.actions.0.flow.effet.apparence.id :: L’objet « ${objet.id} » n’admet pas l’apparence « cape ».`,
    ]);
  });

  it.each([
    ['apparencesObjets null', { appearance: { apparencesObjets: null } }, 'scenes.0.entities.1.appearance.apparencesObjets :: Entrée invalide : record attendu, null reçu'],
    ['apparencesObjets valeur chaîne', { appearance: { apparencesObjets: { [objet.id]: 'epee' } } }, `scenes.0.entities.1.appearance.apparencesObjets.${objet.id} :: Entrée invalide : objet attendu, chaîne de caractères reçu`],
    ['apparencesObjets valeur null', { appearance: { apparencesObjets: { [objet.id]: null } } }, `scenes.0.entities.1.appearance.apparencesObjets.${objet.id} :: Entrée invalide : objet attendu, null reçu`],
    ['Effet giveTrapping apparence chaîne', { effet: { type: 'giveTrapping', trappingId: objet.id, apparence: 'cape' } }, 'scenes.0.entities.0.usable.actions.0.flow.effet.apparence :: Entrée invalide : objet attendu, chaîne de caractères reçu'],
  ] as const)('%s : le contrôle sous portée se tait, seule la faute de forme du nœud sort', (_cas, malforme, attendue) => {
    const doc = document(objet.id) as { scenes: { entities: Record<string, unknown>[] }[] };
    const [coffre, pnj] = doc.scenes[0].entities as [{ usable: { actions: { flow: Record<string, unknown> }[] } }, Record<string, unknown>];
    if ('effet' in malforme) coffre.usable.actions[0].flow.effet = malforme.effet;
    else pnj.appearance = malforme.appearance;
    const r = projetSchema.safeParse(doc);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`)).toEqual([attendue]);
  });

  /** Le refus d'absence de `objet` aux quatre positions : une entrée sans id lisible n'en porte aucun. */
  const absentPartout = POSITIONS.map(([chemin]) => `${chemin.replace('@', objet.id)} :: « ${objet.id} » est absent du catalogue des objets de la campagne (collection « narratif.objets » du document).`);
  it.each([
    ['formChoices 5', { ...objet, formChoices: 5 }, ['narratif.objets.0.formChoices :: Entrée invalide : tableau attendu, nombre reçu']],
    ['shape null', { ...objet, shape: null }, ['narratif.objets.0.shape :: Entrée invalide : objet attendu, null reçu']],
    ['entrée null', null, ['narratif.objets.0 :: Entrée invalide : objet attendu, null reçu', ...absentPartout]],
    ['entrée chaîne', objet.id, ['narratif.objets.0 :: Entrée invalide : objet attendu, chaîne de caractères reçu', ...absentPartout]],
  ] as const)('objet de la campagne malformé (%s) : le contrôle sous portée se tait, seule la faute de forme de l’objet sort', (_cas, malforme, attendues) => {
    const doc = document(objet.id) as { narratif: { objets: unknown[] }; scenes: { entities: { usable?: { actions: { flow: { effet: Record<string, unknown> } }[] } }[] }[] };
    doc.narratif.objets = [malforme];
    doc.scenes[0].entities[0].usable!.actions[0].flow.effet.apparence = { id: 'cape' };
    const r = projetSchema.safeParse(doc);
    expect((r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`)).sort()).toEqual([...attendues].sort());
  });

  /** Les sites de `OBJETS_DU_PROJET` d'un projet, lus par `sitesDeLaPortee`, au format des repères. */
  const sitesDe = (doc: unknown) => sitesDeLaPortee(projetSchema, doc, OBJETS_DU_PROJET).map((s) => [s.chemin.join('.'), s.parCle] as const).sort();
  const SITES_DE_L_OBJET = POSITIONS.map(([chemin, parCle]) => [chemin.replace('@', objet.id), parCle] as const).sort();
  type Doc = {
    narratif: { objets: Record<string, unknown>[]; etats: unknown[] };
    scenes: { entities: [{ usable: { actions: { flow: { effet: Record<string, unknown> } }[] } }, { appearance: Record<string, unknown> }] }[];
  };

  it('`sitesDeLaPortee` rend, sur un projet valide, les repères locaux du parse de mesure : mêmes chemins, mêmes `parCle`', () => {
    const doc = document(objet.id);
    const reperes = mesureDuParse(projetSchema, doc).reperes.filter((r) => r.type === 'local:narratif.objets').map((r) => [r.path.join('.'), r.parCle] as const).sort();
    expect(sitesDe(doc)).toEqual(reperes);
    expect(sitesDe(doc)).toEqual(SITES_DE_L_OBJET);
  });

  it.each([
    ['un état sans `source`', (doc: Doc): void => void doc.narratif.etats.push({ id: 'etat-neuf', label: 'État neuf', forme: { kind: 'heros' } })],
    ['une clé en trop dans l’Effet porteur', (doc: Doc): void => void (doc.scenes[0].entities[0].usable.actions[0].flow.effet.bidon = 1)],
    ['l’objet visé sans `source`', (doc: Doc): void => void delete doc.narratif.objets[0].source],
  ] as const)('projet fautif (%s) : `sitesDeLaPortee` rend les mêmes sites, sans parse', (_cas, fauter) => {
    const doc = structuredClone(document(objet.id)) as unknown as Doc;
    fauter(doc);
    expect(projetSchema.safeParse(doc).success).toBe(false);
    expect(sitesDe(doc)).toEqual(SITES_DE_L_OBJET);
  });

  it.each([
    ['apparencesObjets null', (doc: Doc): void => void (doc.scenes[0].entities[1].appearance.apparencesObjets = null), 2],
    ['op null', (doc: Doc): void => void (doc.scenes[0].entities[0].usable.actions[1].flow.effet.ops = [null]), 1],
  ] as const)('valeur malformée (%s) : `sitesDeLaPortee` ne lève pas et la saute', (_cas, malformer, rang) => {
    const doc = structuredClone(document(objet.id)) as unknown as Doc;
    malformer(doc);
    const [chemin, parCle] = POSITIONS[rang];
    expect(sitesDe(doc)).toEqual(SITES_DE_L_OBJET.filter(([c, p]) => c !== chemin.replace('@', objet.id) || p !== parCle));
  });

  it.each([
    ['un autre objet de la campagne', 'autre-objet'],
    ['un id inconnu', 'objet-fantome'],
  ])('sous un objet de la campagne, l’ouvreur intérieur juge seul (%s) : aucun site, une faute, celle du catalogue', (_cas, vise) => {
    const doc = structuredClone(document(objet.id)) as unknown as Doc;
    doc.narratif.objets = [{ ...objet, passive: [{ op: 'giveTrapping', trappingId: vise }] }, objetDeCampagne({ id: 'autre-objet' })];
    expect(sitesDe(doc)).toEqual(SITES_DE_L_OBJET);
    const r = projetSchema.safeParse(doc);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} :: ${i.message}`)).toEqual([
      `narratif.objets.0.passive.0.trappingId :: « ${vise} » est absent du catalogue des objets (trappings.json).`,
    ]);
  });

  it('`sitesDeLaPortee` lit toute portée : les scènes d’un projet commité sont ses repères locaux `scenes`', () => {
    const doc = versDisque(diligenceProjet);
    const reperes = mesureDuParse(projetSchema, doc).reperes.filter((r) => r.type === 'local:scenes').map((r) => r.path.join('.')).sort();
    expect(reperes.length).toBeGreaterThan(0);
    expect(sitesDeLaPortee(projetSchema, doc, SCENES_DU_PROJET).map((s) => s.chemin.join('.')).sort()).toEqual(reperes);
  });
});

describe('références de campagne dans la scène, les dotations et les objets embarqués', () => {
  const objet = objetDeCampagne();
  const arme = objetDeCampagne({ id: 'arme-enchantee' });
  const don = (id: string) => ({ op: 'giveTrapping', trappingId: id });
  const feuille = (effet: Jouet) => ({ kind: 'effet', effet });
  const ops = (...operations: Jouet[]) => ({ type: 'ops', ops: operations });
  const touche = (op: Jouet) => ({ trigger: 'onHit', on: 'victime', flow: feuille(ops(op)) });
  const invocation = (id: string, chooseForm = false) => ({ op: 'grantWeapon', label: 'Arme invoquée', damage: 3, form: { id }, chooseForm });
  const pnj = (champs: Jouet) => ({ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, ...champs });
  const action = (effet: Jouet) => ({
    id: 'coffre', kind: 'prop', decor: { id: 'coffre' }, pos: { x: 2, y: 2 },
    usable: { actions: [{ id: 'ouvrir', flow: feuille(effet) }] },
  });
  const document = (id: string) => projet({
    narratif: {
      ...emptyNarratif(),
      objets: [objet, { ...arme, onHitEffects: [touche(don(id))] }],
      presetsPnj: [{ id: 'preset', base: { id: 'humain' }, profil: { trappings: [{ id, count: { fixed: 2 } }] } }],
    },
    scenes: [sceneMinimale({ entities: [pnj({ presetId: 'preset', inventaire: { [id]: true } }), action(ops(invocation(id)))] })],
  });
  const sites = (id: string) => [
    { chemin: ['narratif', 'objets', 1, 'onHitEffects', 0, 'flow', 'effet', 'ops', 0, 'trappingId'], id, parCle: false },
    { chemin: ['narratif', 'presetsPnj', 0, 'profil', 'trappings', 0, 'id'], id, parCle: false },
    { chemin: ['scenes', 0, 'entities', 0, 'inventaire', id], id, parCle: true },
    { chemin: ['scenes', 0, 'entities', 1, 'usable', 'actions', 0, 'flow', 'effet', 'ops', 0, 'form', 'id'], id, parCle: false },
  ];

  const lire = (doc: unknown) =>
    sitesDeLaPortee(projetSchema, doc, OBJETS_DU_PROJET).slice().sort((a, b) => a.chemin.join('.').localeCompare(b.chemin.join('.')));

  it('les quatre références sont suivies au renommage et refusent un retrait, y compris la clé d’inventaire', () => {
    const edite = parseProject(document(objet.id));
    expect(lire(edite)).toEqual(sites(objet.id));
    expect(retireDuProjet(edite, { registre: 'objets', id: objet.id })).toBe(edite);
    const nouveau = 'possession-renommee';
    const renomme = renommeAuProjet(edite, { registre: 'objets', id: objet.id }, nouveau);
    expect(renomme.narratif.objets[0].id).toBe(nouveau);
    expect(renomme.scenes[0].entities[0].inventaire).toEqual({ [nouveau]: true });
    expect(lire(renomme)).toEqual(sites(nouveau));
    expect(retireDuProjet(renomme, { registre: 'objets', id: nouveau })).toBe(renomme);
    expect(() => parseProject(renomme)).not.toThrow();
  });

  it('un objet absent ou un service embarqué laisse quatre références refusées à leurs chemins', () => {
    const fantome = 'objet-absent';
    const service = document(objet.id);
    (service.narratif as { objets: Jouet[] }).objets[0] = { ...objet, service: true };
    for (const [id, doc] of [[fantome, document(fantome)], [objet.id, service]] as const) {
      const r = projetSchema.safeParse(doc);
      expect(r.success).toBe(false);
      expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.')).sort()).toEqual(sites(id).map((s) => s.chemin.join('.')));
    }
  });

  it('le Bestiaire et le preset mesurent la possession typée et la dotation directe dans leurs portées propres', () => {
    const monture = { type: 'creature', id: 'cheval-de-guerre-leger' };
    const fiche = { ...findCreatureById('humain')!, trappings: [monture, { id: 'arme-simple' }] };
    const reperes = mesureDuParse(bestiaire, [fiche]).reperes.filter((r) => r.path.includes('trappings'));
    expect(reperes.map((r) => r.type)).toEqual(['creature', 'trapping']);

    const prefixe = ['narratif', 'presetsPnj', 0, 'profil', 'trappings'] as const;
    const paquet = (dotation: Jouet) => projet({
      narratif: { ...emptyNarratif(), objets: [objet], presetsPnj: [{ id: 'preset', base: { id: 'humain' }, profil: { trappings: [monture, dotation] } }] },
    });
    const doc = paquet({ id: objet.id });
    expect(mesureDuParse(projetSchema, doc).reperes.filter((r) => r.path.includes('trappings')).map((r) => r.type))
      .toEqual(['creature', 'local:narratif.objets']);
    const noeudsDeMonture = noeudsAuChemin(projetSchema, doc, [...prefixe, 0, 'id']);
    expect(noeudsDeMonture.map(declarationDeFeuilleDId).filter((d) => d !== undefined)).toEqual([{ type: 'creature' }]);
    const choixDeMonture = noeudsDeMonture.flatMap((n) => (choixDuNoeud(n) ?? []).map((c) => c.valeur));
    expect(choixDeMonture).toContain(monture.id);
    expect(choixDeMonture).not.toContain('arme-simple');
    const r = projetSchema.safeParse(paquet({ id: 'possession-pendante' }));
    expect(r.success ? [] : r.error.issues.map((i) => i.path)).toEqual([[...prefixe, 1, 'id']]);
    const armure = paquet({ id: objet.id, decritLeTraitArmure: true });
    expect(projetSchema.safeParse(armure).success).toBe(false);
    expect(sitesDeLaPortee(projetSchema, armure, OBJETS_DU_PROJET)).toEqual([]);
  });

  it('la même entrée dans le catalogue autonome refuse un don local dans son effet à la touche', () => {
    const local = { ...arme, onHitEffects: [touche(don(objet.id))] };
    const global = { ...arme, onHitEffects: [touche(don('arme-simple'))] };
    expect(catalogueDesObjets.safeParse([global]).success).toBe(true);
    const r = catalogueDesObjets.safeParse([local, objet]);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path)).toEqual([[0, 'onHitEffects', 0, 'flow', 'effet', 'ops', 0, 'trappingId']]);
  });

  it.each([
    ['passive', [don(objet.id)]],
    ['passifDArme', [don(objet.id)]],
    ['onHitEffects', [touche({ op: 'augmentWeapon', passive: [don(objet.id)] })]],
  ] as const)('la référence dans %s garde le catalogue seul pour un canal passif', (champ, contenu) => {
    const r = projetSchema.safeParse(projet({ narratif: { ...emptyNarratif(), objets: [objet, { ...arme, [champ]: contenu }] } }));
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => [i.path.slice(0, 4), i.message])).toEqual([
      [['narratif', 'objets', 1, champ], expect.stringContaining('est absent du catalogue des objets (trappings.json)')],
    ]);
  });

  it('les flux d’un objet porté suivent le renommage et refusent le retrait dans le projet seul', () => {
    const porteuse = { ...arme, effects: [touche(don(objet.id))], consumable: feuille(ops(don(objet.id))) };
    const edite = parseProject(projet({ narratif: { ...emptyNarratif(), objets: [objet, porteuse] } }));
    const positions = (doc: unknown) => sitesDeLaPortee(projetSchema, doc, OBJETS_DU_PROJET)
      .map(({ chemin, id }) => ({ chemin: chemin.join('.'), id })).sort((a, b) => a.chemin.localeCompare(b.chemin));
    const sites = (id: string) => [
      { chemin: 'narratif.objets.1.consumable.effet.ops.0.trappingId', id },
      { chemin: 'narratif.objets.1.effects.0.flow.effet.ops.0.trappingId', id },
    ];
    expect(positions(edite)).toEqual(sites(objet.id));
    expect(retireDuProjet(edite, { registre: 'objets', id: objet.id })).toBe(edite);
    const nouveau = 'possession-renommee';
    const renomme = renommeAuProjet(edite, { registre: 'objets', id: objet.id }, nouveau);
    expect(positions(renomme)).toEqual(sites(nouveau));
    expect(() => parseProject(renomme)).not.toThrow();

    const catalogue = catalogueDesObjets.safeParse([porteuse, objet]);
    expect(catalogue.success ? [] : catalogue.error.issues.map((issue) => issue.path.join('.')).sort()).toEqual([
      '0.consumable.effet.ops.0.trappingId', '0.effects.0.flow.effet.ops.0.trappingId',
    ]);
  });

  it.each(['consumable', 'effects'] as const)('%s d’un objet de campagne nomme l’enjeu du Test, même pour donner un objet du catalogue', (champ) => {
    const racine = {
      kind: 'test', test: { characteristic: 'endurance' },
      reussite: feuille(ops(don('arme-simple'))), echec: { kind: 'sequence', etapes: [] },
    };
    const porteur = (flow: typeof racine) => ({
      ...arme, [champ]: champ === 'effects' ? [{ trigger: 'onTurnStart', on: 'soi', flow }] : flow,
    });
    const documentPorteur = (flow: typeof racine) => projet({
      narratif: { ...emptyNarratif(), objets: [porteur(flow)] },
    });
    expect(catalogueDesObjets.safeParse([porteur(racine)]).success).toBe(true);
    const r = projetSchema.safeParse(documentPorteur(racine));
    expect(r.success ? [] : r.error.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      [champ === 'effects' ? 'narratif.objets.0.effects.0.flow.test.stake' : 'narratif.objets.0.consumable.test.stake',
        expect.stringContaining('déclarer son enjeu')],
    ]);
    const testNomme = { ...racine.test, stake: { authored: 'Obtenir l’arme promise.' } };
    expect(projetSchema.safeParse(documentPorteur({ ...racine, test: testNomme })).success).toBe(true);
  });

  it('un Test imbriqué reste hors portée pour un effet d’objet en fin de Round', () => {
    const test = {
      kind: 'test', test: { characteristic: 'endurance', stake: { authored: 'Obtenir l’arme promise.' } },
      reussite: feuille(ops(don(objet.id))), echec: { kind: 'sequence', etapes: [] },
    };
    const withRoundEnd = (flow: unknown) => projet({
      narratif: { ...emptyNarratif(), objets: [objet, { ...arme, effects: [{ trigger: 'onRoundEnd', on: 'soi', flow }] }] },
    });
    expect(projetSchema.safeParse(withRoundEnd(test)).success).toBe(true);
    const r = projetSchema.safeParse(withRoundEnd({ kind: 'sequence', etapes: [test] }));
    expect(r.success ? [] : r.error.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      ['narratif.objets.1.effects.0.flow.etapes.0.reussite.effet.ops.0.trappingId', expect.stringContaining('Test à la racine')],
    ]);
  });

  describe('déclenchement d’un objet porté qui référence un objet local', () => {
    const documentPorteur = (effet: Jouet) => projet({
      narratif: { ...emptyNarratif(), objets: [objet, { ...arme, effects: [effet] }] },
    });
    const avecDon = (trigger: string, id: string, optional: boolean, gratuite: boolean) => ({
      trigger, on: 'soi', optional,
      flow: feuille(ops(don(id), ...(gratuite ? [{ op: 'grantFreeAttack', weapon: 'held', when: 'immediate' }] : []))),
    });

    it.each([
      ['onTurnStart', true, false, 'n’ouvre pas de choix'],
      ['onHit', true, false, 'n’ouvre pas de choix'],
      ['onTurnStart', false, true, 'n’ouvre pas d’attaque gratuite'],
      ['onCrit', false, true, 'n’ouvre pas d’attaque gratuite'],
    ] as const)('%s refuse la référence sans chemin de jeu (facultatif=%s, gratuite=%s)', (trigger, optional, gratuite, motif) => {
      const r = projetSchema.safeParse(documentPorteur(avecDon(trigger, objet.id, optional, gratuite)));
      expect(r.success ? [] : r.error.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
        ['narratif.objets.1.effects.0.flow.effet.ops.0.trappingId', expect.stringContaining(motif)],
      ]);
      const global = avecDon(trigger, 'arme-simple', optional, gratuite);
      expect(projetSchema.safeParse(documentPorteur(global)).success).toBe(true);
      expect(catalogueDesObjets.safeParse([{ ...arme, effects: [global] }]).success).toBe(true);
    });

    it.each(['onHit', 'onCharged'] as const)('%s admet le don local et la réaction gratuite', (trigger) => {
      expect(projetSchema.safeParse(documentPorteur(avecDon(trigger, objet.id, false, true))).success).toBe(true);
    });

    it('le début du Tour peut donner directement ou laisser le porteur choisir avant un Test', () => {
      expect(projetSchema.safeParse(documentPorteur(avecDon('onTurnStart', objet.id, false, false))).success).toBe(true);
      const avecTest = {
        trigger: 'onTurnStart', on: 'soi', optional: true,
        flow: {
          kind: 'test', test: { characteristic: 'endurance', stake: { authored: 'Obtenir l’arme promise.' } },
          reussite: feuille(ops(don(objet.id))), echec: { kind: 'sequence', etapes: [] },
        },
      };
      expect(projetSchema.safeParse(documentPorteur(avecTest)).success).toBe(true);
    });
  });

  it.each([
    [{ categorie: 'trapping' }, 'onHit', 'arme de campagne maniable'],
    [{ service: true }, 'onHit', 'arme de campagne maniable'],
    [{ qualities: [{ id: 'equipe' }] }, 'onHit', 'arme de campagne maniable'],
    [{}, 'onRoundEnd', 'ne reçoit pas l’arme du coup'],
    [{}, 'onDayStart', 'ne reçoit pas l’arme du coup'],
  ] as const)('une référence locale à la touche exige un porteur et un déclencheur jouables (%j, %s)', (champs, trigger, refus) => {
    const projetAvecDon = (id: string) => projet({
      narratif: { ...emptyNarratif(), objets: [objet, { ...arme, ...champs, onHitEffects: [{ ...touche(don(id)), trigger }] }] },
    });
    expect(projetSchema.safeParse(projetAvecDon('arme-simple')).success).toBe(true);
    const r = projetSchema.safeParse(projetAvecDon(objet.id));
    expect(r.success ? [] : r.error.issues.map((i) => [i.path, i.message])).toEqual([
      [sites(objet.id)[0].chemin, expect.stringContaining(refus)],
    ]);
  });

  it.each([
    ['un filtre de tir sur une arme de mêlée', (id: string) => ({ ...touche(don(id)), attackType: 'distance' }), 'type d’attaque'],
    ['un effet d’augmentation sans arme', (id: string) => touche({
      op: 'augmentWeapon', onHitEffects: [{ ...touche(don(id)), trigger: 'onDayStart' }],
    }), 'ne reçoit pas l’arme du coup'],
    ['un effet d’invocation sans arme', (id: string) => touche({
      op: 'grantWeapon', label: 'Invocation', damage: 2, onHitEffects: [{ ...touche(don(id)), trigger: 'onDayStart' }],
    }), 'ne reçoit pas l’arme du coup'],
    ['un filtre de tir sur une arme invoquée', (id: string) => touche({
      op: 'grantWeapon', label: 'Invocation', damage: 2, onHitEffects: [{ ...touche(don(id)), attackType: 'distance' }],
    }), 'type d’attaque'],
  ] as const)('%s ne donne pas d’objet de campagne', (_cas, effet, cause) => {
    const projetAvecDon = (id: string) => projet({
      narratif: { ...emptyNarratif(), objets: [objet, { ...arme, onHitEffects: [effet(id)] }] },
    });
    expect(projetSchema.safeParse(projetAvecDon('arme-simple')).success).toBe(true);
    const r = projetSchema.safeParse(projetAvecDon(objet.id));
    expect(r.success ? [] : r.error.issues.map((i) => [i.path.slice(-1)[0], i.message])).toEqual([
      ['trappingId', expect.stringContaining(cause)],
    ]);
  });

  it.each([
    { pick: 1, of: [{ id: objet.id }, { id: 'arme-simple' }] },
    { pick: 1, of: [{ lot: [{ id: objet.id }, { id: 'arme-simple' }] }, { id: 'arme-simple' }] },
    { id: objet.id, decritLeTraitArmure: true },
  ])('une dotation de choix, de lot ou liée au Trait Armure conserve sa référence fermée (%j)', (dotation) => {
    const r = projetSchema.safeParse(projet({
      narratif: { ...emptyNarratif(), objets: [objet], presetsPnj: [{ id: 'preset', base: { id: 'humain' }, profil: { trappings: [dotation] } }] },
    }));
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.slice(0, 5))).toContainEqual(['narratif', 'presetsPnj', 0, 'profil', 'trappings']);
  });

  it.each([
    [objet, true, 'Une forme fixe de campagne est incompatible avec le choix de la forme.'],
    [{ ...objet, shape: undefined }, false, 'L’objet de campagne choisi doit déclarer une forme.'],
  ] as const)('une forme locale fixe déclare une apparence réellement appliquée (%j)', (modele, chooseForm, refus) => {
    const r = projetSchema.safeParse(projet({
      narratif: { ...emptyNarratif(), objets: [modele] },
      scenes: [sceneMinimale({ entities: [action(ops(invocation(modele.id, chooseForm)))] })],
    }));
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toEqual([refus]);
  });

  it.each([
    [pnj({ creature: { id: 'humain' }, postes: [{ trappingId: objet.id }] }), 'postes.0.trappingId', 'siege-engines.json'],
    [pnj({ creature: { id: 'humain' }, postes: [{ trappingId: 'baliste', ammo: { [objet.id]: 1 } }] }), 'postes.0.ammo.' + objet.id, 'ammunition'],
    [pnj({ creature: { id: 'humain' }, postes: [{ trappingId: 'baliste', ammo: { 'carreau-de-baliste': 1 }, selectedAmmo: { id: objet.id } }] }), 'postes.0.selectedAmmo.id', 'ammunition'],
    [pnj({ engin: { id: objet.id } }), 'engin.id', 'siege-engines.json'],
    [action({ type: 'setVessel', provisions: 1, vivre: { id: objet.id } }), 'usable.actions.0.flow.effet.vivre.id', 'trappings.json'],
    [action({ type: 'adjustVessel', provisions: 1, vivre: { id: objet.id } }), 'usable.actions.0.flow.effet.vivre.id', 'trappings.json'],
    [action(ops({ op: 'provisions', rations: 1, vivre: { id: objet.id } })), 'usable.actions.0.flow.effet.ops.0.vivre.id', 'trappings.json'],
    [action(ops({ op: 'provisions', jours: 1, vivre: { id: objet.id } })), 'usable.actions.0.flow.effet.ops.0.vivre.id', 'trappings.json'],
  ] as const)('les postes, corps de siège et vivres gardent leurs catalogues (%j)', (entite, suffixe, catalogue) => {
    const r = projetSchema.safeParse(projet({
      narratif: { ...emptyNarratif(), objets: [objet] },
      scenes: [sceneMinimale({ entities: [entite] })],
    }));
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => [i.path.join('.'), i.message]))
      .toContainEqual([`scenes.0.entities.0.${suffixe}`, expect.stringContaining(catalogue)]);
  });
});

describe('projetSchema — la FORME que voit le seam (avant normalizeScene/resolvePortRef)', () => {
  it('un projet minimal parse : les collections que `normalizeScene` comble sont OPTIONNELLES', () => {
    const res = projetSchema.safeParse(projet());
    expect(res.success, res.success ? '' : JSON.stringify(res.error.issues.slice(0, 3))).toBe(true);
  });

  it('une scène SANS `entities` (document antérieur, comblé par `normalizeScene`) est VALIDE', () => {
    expect(projetSchema.safeParse(projet()).success).toBe(true);
    expect('entities' in sceneMinimale()).toBe(false);
  });

  /**
   * DÉCOR UTILISABLE (#1687) : l'enveloppe `usable` porte DEUX faits nommés, et le champ `interact`
   * d'avant le lot n'existe plus — un document qui en porte un est REFUSÉ, à son chemin, plutôt
   * qu'ignoré en silence.
   */
  it('`usable` : l’enveloppe à deux faits passe, `interact` est REFUSÉ, un `id` d’action DOUBLÉ aussi', () => {
    const FLOW = { kind: 'sequence', etapes: [] };
    const entite = (over: Jouet) => [sceneMinimale({ entities: [{ id: 'coffre', kind: 'prop', pos: { x: 1, y: 1 }, decor: { id: 'coffre' }, ...over }] })];

    expect(projetSchema.safeParse(projet({ scenes: entite({ usable: { assise: true, actions: [{ id: 'fouiller', flow: FLOW, unique: true }] } }) })).success).toBe(true);
    expect(fautesCodees(projet({ scenes: entite({ interact: { flow: FLOW } }) })))
      .toEqual(['scenes.0.entities.0 :: unrecognized_keys ["interact"]']);
    expect(fautes(projet({ scenes: entite({ usable: { actions: [{ id: 'fouiller', flow: FLOW }, { id: 'fouiller', flow: FLOW }] } }) })))
      .toEqual(['scène « scene-1 » › entité « coffre » › utilisable › actions « fouiller » :: « fouiller » dupliqué : « id » identifie l’élément dans sa liste, il y est unique.']);
    // `assise` ne se DÉSACTIVE pas par `false` : le fait est présent ou absent, jamais nié.
    expect(fautes(projet({ scenes: entite({ usable: { assise: false } }) })).length).toBeGreaterThan(0);
  });

  it('un `port` SPARSE `{ ref }` (avant `resolvePortRef`) est VALIDE ; sans `ref`, le profil est exigé EN ENTIER', () => {
    const carte = (port: Jouet) => ({
      id: 'carte',
      label: 'Le monde',
      places: [{ id: 'lieu-1', label: 'Port', pos: { x: 1, y: 2 }, scene: { id: 'scene-1' }, port }],
      routes: [],
    });
    expect(projetSchema.safeParse(projet({ worldMap: carte({ ref: 'marienburg', signal: 'phare' }) })).success).toBe(true);
    expect(fautes(projet({ worldMap: carte({ taille: 3 }) }))).toEqual([
      expect.stringContaining('Carte du monde › lieux « lieu-1 » › port › richesse'),
      expect.stringContaining('Carte du monde › lieux « lieu-1 » › port › production'),
    ]);
  });

  it('`schema: 2` est REFUSÉ (littéral COURANT — un document non migré n\'entre pas par cette porte)', () => {
    expect(fautes(projet({ schema: 2 }))[0]).toContain('schema');
  });

  /**
   * PLAGE de pente (`PENTE_TOIT_DEG`) : une toiture verticale ou plate n'est pas une toiture, et la
   * même plage borne la pente de RÉFÉRENCE de la scène et la pente POSÉE sur un corps. Le refus est
   * nominatif, au chemin — la garde ne dit pas « invalide », elle dit OÙ.
   */
  it('une pente de RÉFÉRENCE hors plage est REFUSÉE au chemin, aux DEUX bornes', () => {
    const pente = (deg: number) => fautesCodees(projet({ scenes: [sceneMinimale({ roofDefaults: { material: { id: 'toit-ardoise' }, pitchDeg: deg, riseMaxStoreys: 1 } })] }));
    expect(pente(90)).toEqual([`scenes.0.roofDefaults.pitchDeg :: too_big ${PENTE_TOIT_DEG.max}`]);
    expect(pente(0)).toEqual([`scenes.0.roofDefaults.pitchDeg :: too_small ${PENTE_TOIT_DEG.min}`]);
    expect(projetSchema.safeParse(projet({ scenes: [sceneMinimale({ roofDefaults: { material: { id: 'toit-ardoise' }, pitchDeg: PENTE_TOIT_DEG.max, riseMaxStoreys: 1 } })] })).success).toBe(true);
  });

  it('une pente POSÉE sur un CORPS suit la même plage, au chemin du corps', () => {
    const corps = [{ id: 'corps-1', storeys: [], facades: [], masses: [], roofDefaults: { pitchDeg: 90 } }];
    expect(fautesCodees(projet({ scenes: [sceneMinimale({ architecture: corps })] }))).toEqual([
      `scenes.0.architecture.0.roofDefaults.pitchDeg :: too_big ${PENTE_TOIT_DEG.max}`,
    ]);
  });

  it('une clé inconnue sur une scène est REFUSÉE (schéma STRICT)', () => {
    expect(fautesCodees(projet({ scenes: [sceneMinimale({ inventedField: 'poison' })] }))).toEqual([
      'scenes.0 :: unrecognized_keys ["inventedField"]',
    ]);
  });

  /**
   * Le STATBLOC EMBARQUÉ est déclaré CHAMP PAR CHAMP, calé sur `CustomStatblock` : aucun champ n'y est
   * plus large que l'interface TS. `char` est le seul qui pourrait l'être en silence — écrit en
   * `z.record(z.string(), …)` il avalerait n'importe quelle clé, et une coquille d'authoring
   * (`endurence`, `ZZZZ`) vivrait dans la donnée sans jamais rien modifier au jeu.
   */
  const statblocMinimal = (over: Jouet = {}): Jouet => ({ type: 'statblock', label: 'Rat géant', char: { B: 5 }, ...over });
  const avecStatbloc = (sb: Jouet): Jouet =>
    projet({ scenes: [sceneMinimale({ entities: [{ id: 'e1', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: sb }] })] });

  it('le statbloc embarqué : `char` n’accepte QUE les 10 Caractéristiques ∪ M ∪ B', () => {
    // Témoin POSITIF : les clés du canon passent, et `char` reste PARTIEL (aucune n'est exigée).
    expect(projetSchema.safeParse(avecStatbloc(statblocMinimal({ char: { 'capacite-de-combat': 30, M: 4, B: 5 } }))).success).toBe(true);
    expect(projetSchema.safeParse(avecStatbloc(statblocMinimal({ char: {} }))).success).toBe(true);
    // Une clé HORS canon est nommée, jamais avalée.
    expect(fautesCodees(avecStatbloc(statblocMinimal({ char: { ZZZZ: 7 } })))).toEqual([
      'scenes.0.entities.0.statblock.char :: unrecognized_keys ["ZZZZ"]',
    ]);
    // La coquille d'authoring la plus plausible — une Caractéristique mal orthographiée — mord aussi.
    expect(fautesCodees(avecStatbloc(statblocMinimal({ char: { endurence: 35 } })))).toEqual([
      'scenes.0.entities.0.statblock.char :: unrecognized_keys ["endurence"]',
    ]);
  });

  it('le statbloc embarqué DOIT s’annoncer : `type: \'statblock\'` (#1467 L1b)', () => {
    const { type: _sans, ...muet } = statblocMinimal();
    expect(fautesCodees(avecStatbloc(muet))).toEqual([
      'scenes.0.entities.0.statblock.type :: invalid_value ["statblock"]',
    ]);
  });
});

/**
 * UNE arête, UN segment (#1624) — l'invariant que l'index d'arêtes (`noyau/monde/wallIndex.ts`) SUPPOSE
 * et que ses consommateurs consomment (`aretesA(...)[0]`, `noyau/monde/volume/toits.ts`). Mesuré vrai
 * sur les 65 scènes livrées ; `setEdgeWall` (`noyau/sceneEdit.ts`) le tient à la POSE, ce banc le
 * tient à la PORTE — le chemin que prennent l'authoring littéral, les migrations et l'import.
 */
describe('sceneSchema — une arête `x,y,side,z` ne porte qu’un segment', () => {
  const avecMurs = (walls: Jouet[]): Jouet => projet({ scenes: [sceneMinimale({ walls })] });

  it('une arête DUPLIQUÉE est refusée, la clé NOMMÉE à chaque doublon', () => {
    const doublon = (cle: string) => `scène « scene-1 » › murs « ${cle} » :: « ${cle} » dupliqué : « x,y,side,z » identifie l’élément dans sa liste, il y est unique.`;
    expect(fautes(avecMurs([{ x: 14, y: 6, side: 'E' }, { x: 14, y: 6, side: 'E', door: true }]))).toEqual([doublon('14,6,E,0')]);
    // `z` ABSENT et `z: 0` sont la MÊME arête (l'index lit `w.z ?? 0`) : chaque segment en trop est une faute.
    expect(fautes(avecMurs([{ x: 1, y: 2, side: 'N', z: 0 }, { x: 1, y: 2, side: 'N' }, { x: 1, y: 2, side: 'N', window: true }]))).toEqual([
      doublon('1,2,N,0'),
      doublon('1,2,N,0'),
    ]);
  });

  it('deux arêtes de la MÊME case sur des `side` différents sont acceptées', () => {
    expect(projetSchema.safeParse(avecMurs([{ x: 3, y: 3, side: 'N' }, { x: 3, y: 3, side: 'E' }])).success).toBe(true);
  });

  it('la même clé à des ÉTAGES différents est acceptée (`z` fait partie de l’arête)', () => {
    expect(projetSchema.safeParse(avecMurs([{ x: 3, y: 3, side: 'N' }, { x: 3, y: 3, side: 'N', z: 1 }])).success).toBe(true);
  });

  it('la DONNÉE livrée traverse : aucune arête dupliquée dans les scènes de la Diligence', () => {
    const scenes = diligenceProjet.scenes;
    expect(scenes.flatMap((s) => s.walls ?? []).length).toBeGreaterThan(0);
    expect(projetSchema.safeParse(versDisque(diligenceProjet)).success).toBe(true);
  });
});

/**
 * CARDINAL de la grille (#1789) — `tiles`, `height` et `crenellated` sont des tableaux PARALLÈLES
 * aplatis indexés `y·w+x` : l'un d'eux plus court que `w×h` rendrait des trous au MÊME index.
 * `tileAt` (`noyau/monde/scene.ts`) ne porte plus AUCUN repli de tuile ; c'est cette porte qui le permet.
 */
describe('sceneSchema — chaque tableau parallèle d’une couche porte EXACTEMENT `w×h` entrées', () => {
  const pleine = (n: number, t = 'sol') => Array.from({ length: n }, () => t);
  const avecCouches = (layers: Jouet[]): Jouet => projet({ scenes: [sceneMinimale({ layers })] });

  it('une couche AMPUTÉE est refusée, le LIEU nommant la scène et l’étage, le message la longueur et l’attendu', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(15) }]))).toEqual([
      'scène « scene-1 » › couches « 0 » › cases :: `tiles` porte 15 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
  });

  it('une couche TROP LONGUE est refusée de la même façon, et l’étage fautif est celui qui est nommé', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(16) }, { z: 1, tiles: pleine(17) }]))).toEqual([
      'scène « scene-1 » › couches « 1 » › cases :: `tiles` porte 17 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
  });

  it('`height` amputé est refusé en NOMMANT `height` — même index, même trou silencieux (`heightAt` replierait à 0 m)', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(16), height: Array.from({ length: 15 }, () => 0) }]))).toEqual([
      'scène « scene-1 » › couches « 0 » › hauteurs :: `height` porte 15 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
  });

  it('`crenellated` amputé est refusé en NOMMANT `crenellated`, et les deux tableaux présents au cardinal passent', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(16), crenellated: Array.from({ length: 4 }, () => null) }]))).toEqual([
      'scène « scene-1 » › couches « 0 » › créneaux :: `crenellated` porte 4 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
    expect(projetSchema.safeParse(avecCouches([{ z: 0, tiles: pleine(16), height: Array.from({ length: 16 }, () => 0), crenellated: Array.from({ length: 16 }, () => null) }])).success).toBe(true);
  });

  it('les couches EXACTES passent, et une scène sans couche du tout n’invente rien', () => {
    expect(projetSchema.safeParse(avecCouches([{ z: 0, tiles: pleine(16) }, { z: 1, tiles: pleine(16, 'vide') }])).success).toBe(true);
    expect(projetSchema.safeParse(projet({ scenes: [sceneMinimale()] })).success).toBe(true);
  });

  it('la DONNÉE livrée traverse : les couches de la Diligence sont au cardinal', () => {
    const scenes = diligenceProjet.scenes;
    expect(scenes.flatMap((s) => s.layers ?? []).length).toBeGreaterThan(0);
    expect(projetSchema.safeParse(versDisque(diligenceProjet)).success).toBe(true);
  });
});

describe('projetSchema — les quatre sémantiques du seam, chacune NOMMÉE', () => {
  it('(a) `activeAxes` référence un axe inconnu de axes.json → rouge nommant l\'index et l\'id', () => {
    expect(fautes(projet({ activeAxes: ['negoce', 'plongee-sous-marine'] }))).toEqual([
      'Axes actifs 2 :: « plongee-sous-marine » est absent du catalogue des axes (axes.json).',
    ]);
  });

  it('(b) `indice.affaireId` orphelin → rouge nommant le chemin et l\'affaire manquante', () => {
    const narratif = {
      affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
      indices: [{ id: 'indice-1', affaireId: 'affaire-fantome', kind: 'indice', titre: 'x', stades: [{ id: 's1', prose: '' }] }],
      presetsPnj: [],
      objets: [],
      documents: [],
      etats: [],
    };
    expect(fautes(projet({ narratif }))).toEqual([
      'Bloc narratif › indice « indice-1 » › affaire :: affaire inconnue « affaire-fantome » (narratif.affaires).',
    ]);
  });

  it('(b bis) un id de preset qui COLLISIONNE avec la règle globale → rouge nommé', () => {
    const narratif = {
      affaires: [],
      indices: [],
      presetsPnj: [{ id: 'gobelin', base: { id: 'gobelin' } }],
      objets: [],
      documents: [],
      etats: [],
    };
    expect(fautes(projet({ narratif }))).toEqual([
      'Bloc narratif › PNJ « gobelin » › identifiant :: l\'id de preset PNJ « gobelin » collisionne avec un id de la règle globale (créature, possession, véhicule ou structure).',
    ]);
  });

  it('(b ter) un preset sans base ni profil → rouge nommé (contrat de `presetPnjSchema`)', () => {
    const narratif = { affaires: [], indices: [], presetsPnj: [{ id: 'le-borgne' }], objets: [], documents: [], etats: [] };
    expect(fautes(projet({ narratif }))).toEqual([
      'Bloc narratif › PNJ « le-borgne » :: ni base ni profil (au moins l\'un des deux est requis).',
    ]);
  });

  it('(c) `entity.presetId` sans preset déclaré → rouge nommant la scène ET l\'entité', () => {
    const scenes = [sceneMinimale({ entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'le-borgne' }] })];
    expect(fautes(projet({ scenes }))).toEqual([
      'scène « scene-1 » › entité « pnj-1 » › profil précomposé :: preset de PNJ inconnu « le-borgne » (narratif.presetsPnj).',
    ]);
  });

  it('(c bis) le MÊME `presetId`, déclaré au narratif, est VALIDE', () => {
    const scenes = [sceneMinimale({ entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'le-borgne' }] })];
    const narratif = {
      affaires: [],
      indices: [],
      presetsPnj: [{ id: 'le-borgne', profil: { char: { 'capacite-de-combat': 40 }, traits: [] } }],
      objets: [],
      documents: [],
      etats: [],
    };
    expect(projetSchema.safeParse(projet({ scenes, narratif })).success).toBe(true);
  });

  it('(d) identité PLATE : `label` vide → rouge nommant le champ à la RACINE', () => {
    // `.min(1)` vient de l'ENVELOPPE (`grammaire/document.ts`) depuis #1552 : le libellé d'un document
    // n'est jamais la chaîne vide, et c'est vrai des 122 defs, pas du seul projet.
    expect(fautes(projet({ label: '' }))).toEqual([
      expect.stringMatching(/^Nom :: /),
    ]);
  });

  it('(d bis) identité REQUISE : chaque champ du trio AMPUTÉ est rouge, NOMMÉ', () => {
    // #1552 — arbitrage utilisateur 2026-08-31 (AskUser, verbatim choisi) : « Un projet se NOMME
    // avant d'être enregistré (Recommandé) ». `id` et `label` viennent de l'enveloppe,
    // `versionContenu` du document : les trois se mesurent PAR AMPUTATION, jamais par un refine.
    for (const cle of ['id', 'label', 'versionContenu']) {
      expect(fautes(sans(cle)), `« ${cle} » amputé doit être rouge et NOMMÉ`).toEqual([
        expect.stringMatching(new RegExp(`^${({ id: "Identifiant", label: "Nom", versionContenu: "Version de contenu", type: "Type de document" } as Record<string, string>)[cle]} :: `)),
      ]);
    }
    // Les ACCESSOIRES, eux, restent facultatifs — sur un document par ailleurs identifié.
    for (const accessoire of [{ icon: 'scenario/village' }, { desc: 'Une prose.' }, { auteur: 'Une autrice' }]) {
      const nom = Object.keys(accessoire)[0];
      expect(projetSchema.safeParse(projet(accessoire)).success, `« ${nom} » est un accessoire, jamais une exigence`).toBe(true);
    }
  });

  it('(e) le document DOIT s’annoncer : `type: \'projet\'`, et chaque scène EMBARQUÉE aussi (#1552)', () => {
    expect(fautesCodees(sans('type'))).toEqual(['type :: invalid_value ["projet"]']);
    const { type: _muette, ...sceneMuette } = sceneMinimale();
    expect(fautesCodees(projet({ scenes: [sceneMuette] }))).toEqual([
      'scenes.0.type :: invalid_value ["scene"]',
    ]);
  });

  it('(f) PROVENANCE : ni `source` ni `maison` → rouge ; l’une des deux suffit', () => {
    // Refine de FABRIQUE (`grammaire/document.ts`) : une campagne sans folio n'est pas interdite,
    // elle doit DIRE pourquoi. Mesuré au dépôt : la Diligence cite EDO, les 3 autres sont maison.
    expect(fautes(sans('maison'))).toEqual([expect.stringMatching(/^Source :: /)]);
    const avecSource = { ...sans('maison'), source: { book: 'ennemi-dans-l-ombre', page: 12 } };
    expect(projetSchema.safeParse(avecSource).success).toBe(true);
  });

  it('(d ter) la poche `meta` et le `version` RACINE sont REFUSÉS par le SCEAU de l’enveloppe plate', () => {
    // `projetSchema` est le seul contrôle de forme de `parseProject` (#2404) : le sceau nomme la clé
    // d'un autre format à la porte.
    expect(fautes(projet({ version: 1 })).join(' ')).toMatch(/version/);
    expect(fautes(projet({ meta: { id: 'c', label: 'C', version: 1 } })).join(' ')).toMatch(/meta/);
  });
});

/**
 * ANCRAGE au document RÉEL (« La Diligence », le seul paquet committé à citer un folio). Le
 * projet-JOUET ci-dessus prouve la forme ; ici c'est la DONNÉE du dépôt qui traverse la porte, et
 * chaque refus est APPARIÉ à son acceptation — un rouge ne prouve rien s'il ne se distingue pas d'un
 * vert. Les FK (`activeAxes` vers `axes.json`, `presetId` intra-document) ne sont mesurables qu'ici :
 * elles exigent des ids qui EXISTENT.
 */
describe('projetSchema — le document RÉEL, ses FK et son enveloppe (sondes du juge #1552)', () => {
  const reel = () => versDisque(JSON.parse(JSON.stringify(diligenceProjet))) as Jouet;
  const ok = (doc: Jouet) => projetSchema.safeParse(doc).success;
  const sansCle = (cle: string) => { const d = reel(); delete d[cle]; return d; };

  it('le document committé PARSE tel quel — et le handle déclare bien ce qu’il dit déclarer', () => {
    expect(ok(reel())).toBe(true);
    expect(projetDoc.type).toBe('projet');
    expect(projetDoc.famille).toBe('config');
  });

  it('FK `activeAxes` → axes.json : ids RÉELS acceptés (et la liste vide/absente aussi), inconnu REFUSÉ au CHEMIN', () => {
    expect(ok({ ...reel(), activeAxes: ['melee', 'tir'] }), 'axes réels refusés').toBe(true);
    expect(ok({ ...reel(), activeAxes: [] }), 'liste vide = socle de base').toBe(true);
    expect(ok(sansCle('activeAxes')), 'absente = socle de base').toBe(true);
    expect(fautes({ ...reel(), activeAxes: ['axe-qui-nexiste-pas'] })).toEqual([
      'Axes actifs 1 :: « axe-qui-nexiste-pas » est absent du catalogue des axes (axes.json).',
    ]);
    // Un id qui n'est pas un AXE (c'est une compétence) est refusé comme un id inventé : la FK vise
    // `axes.json`, pas « un id connu quelque part ».
    expect(ok({ ...reel(), activeAxes: ['courage'] })).toBe(false);
  });

  it('FK intra-document `presetId` → narratif.presetsPnj : preset DÉCLARÉ accepté, fantôme REFUSÉ au CHEMIN', () => {
    const avecPreset = (presetId: string, declare: boolean): Jouet => {
      const d = reel();
      const scenes = d.scenes as Record<string, unknown>[];
      const entites = (scenes[0].entities as Record<string, unknown>[]);
      scenes[0] = { ...scenes[0], entities: [{ ...entites[0], presetId }, ...entites.slice(1)] };
      const narratif = d.narratif as { presetsPnj: unknown[] };
      if (declare) narratif.presetsPnj = [...narratif.presetsPnj, { id: presetId, profil: { char: { 'capacite-de-combat': 40 }, traits: [] } }];
      return { ...d, scenes };
    };
    expect(ok(avecPreset('preset-temoin', true)), 'preset DÉCLARÉ refusé').toBe(true);
    expect(fautes(avecPreset('preset-fantome', false))).toEqual([
      expect.stringMatching(/^scène « [^»]+ » › entité « [^»]+ » › profil précomposé :: preset de PNJ inconnu « preset-fantome »/),
    ]);
  });

  it('ENVELOPPE sur la donnée réelle : chaque clé d’identité amputée est rouge, NOMMÉE', () => {
    for (const cle of ['id', 'label', 'versionContenu', 'type']) {
      expect(fautes(sansCle(cle)), `« ${cle} » amputé`).toEqual([expect.stringMatching(new RegExp(`^${({ id: "Identifiant", label: "Nom", versionContenu: "Version de contenu", type: "Type de document" } as Record<string, string>)[cle]} :: `))]);
    }
    expect(fautes({ ...reel(), label: '' })).toEqual([expect.stringMatching(/^Nom :: /)]);
    expect(fautesCodees({ ...reel(), type: 'scene' })).toEqual(['type :: invalid_value ["projet"]']);
  });

  it('PROVENANCE réelle : la Diligence cite son folio ; sans provenance c’est rouge, les DEUX ensemble passent', () => {
    expect(reel().source, 'la Diligence cite EDO à sa racine').toBeTruthy();
    expect(fautes(sansCle('source'))).toEqual([expect.stringMatching(/^Source :: /)]);
    // `source` ∨ `maison` : le refine exige AU MOINS une provenance, il n'en interdit pas deux.
    expect(ok({ ...reel(), maison: 'arbitrage maison, en plus du folio' })).toBe(true);
  });

  it('SCEAU sur la donnée réelle : un numéro de forme d’un autre format, clé inconnue et scène muette sont refusés', () => {
    expect(fautesCodees({ ...reel(), schema: 18 })).toEqual([' :: unrecognized_keys ["schema"]']);
    // Chemin VIDE : la clé inconnue est rapportée à la RACINE du document.
    expect(fautesCodees({ ...reel(), champInconnu: 1 })).toEqual([' :: unrecognized_keys ["champInconnu"]']);
    const d = reel();
    const [premiere, ...suivantes] = d.scenes as Jouet[];
    const { type: _muette, ...sceneMuette } = premiere;
    expect(fautesCodees({ ...d, scenes: [sceneMuette, ...suivantes] })).toEqual(['scenes.0.type :: invalid_value ["scene"]']);
  });
});

describe('narratifSchema — un id VIDE est refusé dans les QUATRE registres, chemin nommé', () => {
  const narratif = (over: Jouet = {}): Jouet => ({ ...emptyNarratif(), ...over });
  const indice = (over: Jouet = {}): Jouet => ({ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'x', stades: [{ id: 'stade-1', prose: '' }], ...over });

  it('affaire : `id` vide', () => {
    expect(fautes(narratif({ affaires: [{ id: '', titre: 'Le Marché noir' }] }), narratifSchema)).toEqual([
      'affaires 1 › identifiant :: id vide.',
    ]);
  });

  it('indice : `id` vide', () => {
    const doc = narratif({ affaires: [{ id: 'affaire-a', titre: 'x' }], indices: [indice({ id: '' })] });
    expect(fautes(doc, narratifSchema)).toEqual(['indice 1 › identifiant :: id vide.']);
  });

  it('stade d\'indice : `id` vide', () => {
    const doc = narratif({ affaires: [{ id: 'affaire-a', titre: 'x' }], indices: [indice({ stades: [{ id: '', prose: '' }] })] });
    expect(fautes(doc, narratifSchema)).toEqual(['indice « indice-1 » › stade 1 › identifiant :: id vide.']);
  });

  it('preset PNJ : `id` vide', () => {
    expect(fautes(narratif({ presetsPnj: [{ id: '', base: { id: 'gobelin' } }] }), narratifSchema)).toEqual([
      'PNJ 1 › identifiant :: id vide.',
    ]);
  });

  it('objet : `id` vide', () => {
    expect(fautes(narratif({ objets: [{ ...objetDeCampagne(), id: '' }] }), narratifSchema)).toEqual([
      'objets 1 › Identifiant :: Trop petit : chaîne de caractères doit avoir >=1 caractères',
    ]);
  });
});

/**
 * `couvre` (#2290, `couvreSchema` de `./communs.ts`) — le lien d'un élément du paquet vers les entrées de
 * fiche de dossier de chapitre, posé sur CHAQUE porteur du projet : une liste d'identifiants globaux
 * `ID_D_ENTREE` (`src/data/source/dossier.ts`), sans doublon, refusée au chemin du porteur.
 */
describe('`couvre` (#2290) — sur chaque porteur du projet', () => {
  const FLOW = { kind: 'sequence', etapes: [] };
  const lieu = (id: string, over: Jouet = {}): Jouet => ({ id, label: id, pos: { x: 1, y: 2 }, scene: { id: 'scene-1' }, ...over });
  const carte = (over: { place?: Jouet; route?: Jouet }): Jouet => ({
    worldMap: {
      id: 'carte',
      label: 'Le monde',
      places: [lieu('lieu-1', over.place), lieu('lieu-2')],
      routes: [{ id: 'route-1', a: { id: 'lieu-1' }, b: { id: 'lieu-2' }, km: 10, modes: ['pied'], ...over.route }],
    },
  });
  const PORTEURS: Record<string, (couvre: unknown) => Jouet> = {
    scène: (couvre) => projet({ scenes: [sceneMinimale({ couvre })] }),
    entité: (couvre) => projet({ scenes: [sceneMinimale({ entities: [{ id: 'coffre', kind: 'prop', pos: { x: 1, y: 1 }, decor: { id: 'coffre' }, couvre }] })] }),
    déclencheur: (couvre) => projet({ scenes: [sceneMinimale({ triggers: [{ id: 'trig-1', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: FLOW, couvre }] })] }),
    dialogue: (couvre) => projet({ scenes: [sceneMinimale({ dialogues: [{ id: 'dlg-1', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: 'Bonjour.', choices: [] }], couvre }] })] }),
    rencontre: (couvre) => projet({ scenes: [sceneMinimale({ encounters: [{ id: 'enc-1', couvre }] })] }),
    'zone d’effet': (couvre) => projet({ scenes: [sceneMinimale({ effectZones: [{ id: 'zone-1', label: 'Cour', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, couvre }] })] }),
    'lieu de carte': (couvre) => projet(carte({ place: { couvre } })),
    'route de carte': (couvre) => projet(carte({ route: { couvre } })),
  };

  for (const [nom, doc] of Object.entries(PORTEURS)) {
    it(`${nom} : des identifiants globaux passent ; hors format, puis en double, refusés au chemin`, () => {
      const ok = projetSchema.safeParse(doc(['EDO-01#b3', 'EDO-02#pnj1']));
      expect(ok.success, ok.success ? '' : JSON.stringify(ok.error.issues.slice(0, 3))).toBe(true);
      expect(fautes(doc(['EDO-01-b3']))).toEqual([expect.stringMatching(/entrées couvertes « EDO-01-b3 » :: entrée de fiche : « <ABBR>-<NN>#<id> » attendu\.$/)]);
      expect(fautes(doc(['EDO-01#b3', 'EDO-01#b3']))).toEqual([expect.stringMatching(/entrées couvertes « EDO-01#b3 » :: « EDO-01#b3 » dupliqué : « entrée de fiche » identifie l’élément dans sa liste, il y est unique\.$/)]);
    });
  }
});
