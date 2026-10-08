import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { nommerChamps, nomDeNoeud, nommerNoeud, metaDesChamps } from './meta';
import { PROSES_NOMMEES } from './champs-prose-de-scene';
import { declarationProseNommee, proseNommee, sourceHeritee } from './prose';
import { projetSchema } from '../defs-scenes/projet';
import { indiceStadeSchema, documentNarratifSchema, ouvertureSchema, sousTitreOuvertureSchema, sousTitreClotureSchema } from '../defs-scenes/narratif';
import { massBattleSpecSchema, setObjectiveSchema, grantFavorSchema, journalSchema, sceneFlowSchema } from '../defs-scenes/effets';
import { dialogueNodeSchema, messageIntroductionSchema } from '../defs-scenes/scene';
import { refusRouteSchema } from '../defs-scenes/worldmap';
import { authoredStakeSchema, OP_DEFS, gameOpSchema, OPS_NON_TYPEES } from './mecanique';
import { coDescendre, descendre, enfantsDe, declarationDEnfants, defDe } from './descente';
import { fautesProseFinale, classificationsProseLocale } from '../../../../scripts/guards/lib/proseNommee.mjs';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import { resolve } from 'node:path';
import { couleurHexSchema } from './valeurs';
import { refOuSpec } from './ref';
import { detenteur } from '../../../detenteur.testkit';

const SOURCE = { book: 'ennemi-dans-l-ombre', page: 12 };
const ADAPTE = { book: 'ennemi-dans-l-ombre', page: 14 };
const SITES: Record<keyof typeof PROSES_NOMMEES, { schema: z.ZodType; nu: Record<string, unknown> }> = {
  'narratif.ouverture.pitch': { schema: ouvertureSchema, nu: { titre: 'Titre', pitch: 'Texte.' } },
  'narratif.indices[].stades[].prose': { schema: indiceStadeSchema, nu: { id: 'stade', prose: 'Texte.' } },
  'narratif.documents[].prose': { schema: documentNarratifSchema, nu: { id: 'document', titre: 'Titre', prose: 'Texte.' } },
  'massBattle.terrain': { schema: massBattleSpecSchema, nu: { allyMight: 50, enemyMight: 50, terrain: 'Texte.' } },
  'scenes[].startMessage.texte': { schema: messageIntroductionSchema, nu: { texte: 'Texte.' } },
  'worldMap.routes[].refus.texte': { schema: refusRouteSchema, nu: { texte: 'Texte.' } },
  'narratif.ouverture.sousTitre.texte': { schema: sousTitreOuvertureSchema, nu: { texte: 'Texte.' } },
  'narratif.cloture.sousTitre.texte': { schema: sousTitreClotureSchema, nu: { texte: 'Texte.' } },
  'setObjective.desc': { schema: setObjectiveSchema, nu: { type: 'setObjective', id: 'objectif', desc: 'Texte.' } },
  'grantFavor.desc': { schema: grantFavorSchema, nu: { type: 'grantFavor', level: 'mineure', owedTo: 'Créancier', desc: 'Texte.' } },
  'journal.desc': { schema: journalSchema, nu: { type: 'journal', desc: 'Texte.' } },
  'dialogues[].nodes[].desc': { schema: dialogueNodeSchema, nu: { id: 'n', choices: [], desc: 'Texte.' } },
  'stake.authored': { schema: authoredStakeSchema, nu: { authored: 'Texte.' } },
  'narrative.text': { schema: OP_DEFS.narrative, nu: { op: 'narrative', text: 'Texte.' } },
  'flow.choice.prompt': { schema: (() => { let choix: z.ZodType | undefined; descendre([sceneFlowSchema], ({ noeud }) => { if (declarationProseNommee(noeud) === PROSES_NOMMEES['flow.choice.prompt']) choix = noeud as z.ZodType; }); return choix!; })(), nu: { kind: 'choice', prompt: 'Texte.', yes: { kind: 'seq', steps: [] } } },
};

describe('prose nommée — déclaration et provenance locales', () => {
  const primitives = { descendre, enfantsDe, metaDesChamps, nomDeNoeud, declarationProseNommee, declarationDEnfants, defDe };
  const corpus = detenteur(() => [...readCorpus(['src/data/schemas/defs-scenes']).filter(f => !f.rel.endsWith('.test.ts')), ...readCorpus(['src/data/schemas/grammaire']).filter(f => f.rel.endsWith('/mecanique.ts'))]);
  const mesurer = detenteur(() => classificationsProseLocale(resolve('.'), corpus()));
  it('le corpus local classe ses sorties ouvertes avant toute donnée', () => {
    const mesure = mesurer();
    console.log('classification locale', JSON.stringify({ champs: mesure.champs.length, opaquesImportes: mesure.opaquesImportes.length, exclusions: mesure.champs.filter(c => c.horsContrat).length, catchalls: mesure.champs.filter(c => c.champ === '*').length, opsNonTypees: OPS_NON_TYPEES.length }));
    expect(mesure.fautes).toEqual([]);
  });
  it('les sites finaux et tous les payloads déclarés passent la descente réelle', async () => {
    const mesure = mesurer();
    const bornes: unknown[] = [];
    const corpusLocal = new Set(corpus().map(f => f.rel));
    for (const origine of mesure.importsSchemas) {
      expect(corpusLocal.has(origine.module)).toBe(false);
      const module = await import(resolve('.', origine.module));
      const valeur: unknown = module[origine.nom];
      if (defDe(valeur)) bornes.push(valeur);
    }
    const finale = { bornesAtteintes: new Set<unknown>(), exclusions: new Map<string, { motif: string; preuve: string }>() };
    const fautes = fautesProseFinale([projetSchema, ...Object.values(SITES).map(s => s.schema), gameOpSchema], primitives, bornes, finale);
    console.log('bornes structurées importées', JSON.stringify({ candidates: bornes.length, atteintes: finale.bornesAtteintes.size }));
    console.log('exclusions runtime', JSON.stringify([...finale.exclusions]));
    console.log('défauts runtime', JSON.stringify({ compte: fautes.length, fautes }));
    expect(fautes).toEqual([]);
    expect(declarationDEnfants(gameOpSchema)?.enfants.length).toBe(Object.keys(OP_DEFS).length);
    expect(OPS_NON_TYPEES).not.toContain('narrative');
  });
  it('une catchall technique sans déclaration de dispatch rougit', () => {
    const schema = nommerChamps(z.looseObject({ op: z.string() }), { op: { label: 'op', texte: { regime: 'technique' } } });
    expect(fautesProseFinale([schema], primitives)).toEqual([' : catchall locale sans dispatch-op déclaré']);
    nommerNoeud(schema, { opacite: { nature: 'dispatch-op', raison: 'fixture sans payloads' } });
    expect(fautesProseFinale([schema], primitives)).toContain(' : opacité dispatch-op sans payloads déclarés');
  });
  it('le payload narrative strict refuse un champ inconnu', () => {
    expect(OP_DEFS.narrative.safeParse({ op: 'narrative', text: 'Texte.', inconnu: 'Texte.' }).success).toBe(false);
  });
  it.each([
    ['abrégé', () => { const nouveau = z.string(); return z.object({ nouveau }); }],
    ['spread', () => { const champs = { nouveau: z.string() }; return z.object({ ...champs }); }],
    ['tuple', () => z.object({ t: z.tuple([z.string()]).refine(() => true).optional() })],
    ['catchall', () => z.object({}).catchall(z.string())],
  ] as const)('la descente réelle refuse une sortie %s ouverte sans régime', (_cas, fabriquer) => {
    expect(fautesProseFinale([fabriquer()], primitives).length).toBeGreaterThan(0);
  });
  it('une borne importée explicite ne masque pas la chaîne locale voisine', () => {
    const importee = z.object({ hors: z.string() });
    const schema = nommerChamps(z.object({ importee, t: z.tuple([z.string()]).optional(), nu: z.string() }), {
      importee: { label: 'importée' }, t: { label: 'tuple', texte: { regime: 'technique' } }, nu: { label: 'nu' },
    });
    expect(fautesProseFinale([schema], primitives, [importee])).toEqual(['.nu : texte ouvert sans classification locale']);
  });
  it('une catchall par alias de primitive importée exige son propre dispatch', () => {
    const alias = couleurHexSchema;
    expect(fautesProseFinale([z.object({}).catchall(alias.optional())], primitives)).toEqual([' : catchall locale sans dispatch-op déclaré']);
    expect(fautesProseFinale([z.object({}).catchall(z.enum(['a', 'b']))], primitives)).toEqual([]);
  });
  it('un clone importé identique est borné, une extension locale reste descendue', () => {
    const importee = nommerChamps(z.object({ hors: z.string() }), { hors: { label: 'hors' } });
    expect(fautesProseFinale([importee.refine(() => true)], primitives, [importee])).toEqual([]);
    expect(fautesProseFinale([importee.extend({ nouveau: z.string() })], primitives, [importee])).toContain('.nouveau : texte ouvert sans classification locale');
    expect(fautesProseFinale([importee.extend({ hors: z.string() })], primitives, [importee])).toContain('.hors : texte ouvert sans classification locale');
  });
  it('un extra de refOuSpec local reste contrôlé après la fabrique importée', () => {
    const schema = refOuSpec('skill', { nouveau: nommerNoeud(z.string(), { nom: 'nouveau' }) });
    expect(fautesProseFinale([schema], primitives)).toEqual(['.nouveau : texte ouvert sans classification locale']);
  });
  it('une narration classifiée sans composition reste visible dans une branche imbriquée', () => {
    const nu = nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte', texte: { regime: 'narration' } } });
    expect(fautesProseFinale([z.union([z.literal('autre'), z.array(nu.optional())])], primitives)).toEqual(['|1[].texte : narration sans composition proseNommee']);
  });
  it('la source d’un parent nommé ne devient pas celle de son sous-titre maison', () => {
    const schema = z.strictObject({ ouverture: ouvertureSchema });
    const sousTitre = { texte: 'Sous-titre maison.' };
    let trouves = 0;
    coDescendre(schema, { ouverture: { titre: 'Titre', pitch: 'Pitch.', source: SOURCE, sousTitre } }, p => {
      if (p.valeur === sousTitre.texte) { trouves++; expect(sourceHeritee(p)).toBeUndefined(); }
    });
    expect(trouves).toBe(1);
  });
  it('la frontière nommée est relue avant sa source, même pour sa feuille texte', () => {
    let trouves = 0;
    coDescendre(z.strictObject({ ouverture: ouvertureSchema }), { ouverture: { titre: 'Titre', pitch: 'Pitch.', source: SOURCE } }, p => {
      if (p.valeur === 'Pitch.') { trouves++; expect(sourceHeritee(p)).toBeUndefined(); }
    });
    expect(trouves).toBe(1);
  });
  it('un choix sourcé ne source ni le journal ni la narration maison de ses branches', () => {
    const flow = { kind: 'choice', prompt: 'Entrer ?', source: SOURCE,
      yes: { kind: 'do', effect: { type: 'journal', desc: 'Journal maison.' } },
      no: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'narrative', text: 'Narration maison.' }] } },
    };
    expect(sceneFlowSchema.safeParse(flow).error?.issues).toBeUndefined();
    const trouves: string[] = [];
    coDescendre(sceneFlowSchema, flow, p => {
      if (p.valeur === 'Journal maison.' || p.valeur === 'Narration maison.') {
        trouves.push(p.valeur); expect(sourceHeritee(p)).toBeUndefined();
      }
    });
    expect(trouves).toEqual(['Journal maison.', 'Narration maison.']);
  });
  it.each(['scenes[].startMessage.texte', 'worldMap.routes[].refus.texte', 'narratif.ouverture.sousTitre.texte', 'narratif.cloture.sousTitre.texte'] as const)('%s refuse l’ancienne chaîne', chemin => {
    expect(SITES[chemin].schema.safeParse('Texte.').success).toBe(false);
    expect(SITES[chemin].schema.safeParse({ texte: '   ' }).success).toBe(false);
  });
  for (const chemin of Object.keys(PROSES_NOMMEES) as (keyof typeof PROSES_NOMMEES)[]) {
    const definition = PROSES_NOMMEES[chemin];
    const { schema, nu } = SITES[chemin];
    it(`${chemin} compose sa déclaration du registre`, () => {
      expect(declarationProseNommee(schema)).toBe(definition);
    });
    it(`${chemin} accepte Maison et la copie sourcée par folio`, () => {
      expect(schema.safeParse(nu).success).toBe(true);
      expect(schema.safeParse({ ...nu, source: SOURCE }).success).toBe(definition.porteur === 'folio');
    });
    it(`${chemin} applique son régime d’adaptation`, () => {
      const adapte = schema.safeParse({ ...nu, adapteDe: ADAPTE });
      expect(adapte.success).toBe(definition.regime === 'narration');
      const double = schema.safeParse({ ...nu, source: SOURCE, adapteDe: ADAPTE });
      expect(double.success).toBe(false);
      if (definition.regime === 'narration' && definition.porteur === 'folio') expect(double.error?.issues.map((i) => i.path)).toEqual([['adapteDe']]);
    });
    it(`${chemin} conserve la présence du champ`, () => {
      const sansTexte: Record<string, unknown> = { ...nu };
      delete sansTexte[definition.champ];
      expect(schema.safeParse(sansTexte).success).toBe(definition.presence === 'optionnel');
      expect(schema.safeParse({ ...nu, [definition.champ]: '' }).success).toBe(definition.presence === 'optionnel');
    });
  }

  it('un nouvel objet narratif reçoit automatiquement l’exclusivité', () => {
    const schema = proseNommee(nommerChamps(z.strictObject({ id: z.literal('fixture') }), { id: { label: 'identifiant' } }), 'massBattle.terrain');
    const r = schema.safeParse({ id: 'fixture', terrain: 'Texte.', source: SOURCE, adapteDe: ADAPTE });
    expect(r.error?.issues.map((i) => i.path)).toEqual([['adapteDe']]);
  });

  it.each(Object.keys(PROSES_NOMMEES) as (keyof typeof PROSES_NOMMEES)[])('%s garde sa déclaration après refine, enveloppe, optional et liste', (chemin) => {
    const definition = PROSES_NOMMEES[chemin];
    const { schema: original, nu } = SITES[chemin];
    const clone = original.superRefine(() => {});
    expect(declarationProseNommee(clone)).toBe(definition);
    const schema = z.strictObject({ sites: z.array(clone.optional()).optional() }).optional();
    const declarations: unknown[] = [];
    coDescendre(schema, { sites: [nu] }, (p) => {
      const trouvee = p.noeuds.map(declarationProseNommee).find((d) => d !== undefined);
      if (trouvee) declarations.push(trouvee);
    });
    expect(declarations).toEqual([definition]);
    const adapte = clone.safeParse({ ...nu, adapteDe: ADAPTE });
    expect(adapte.success).toBe(definition.regime === 'narration');
    expect(clone.safeParse({ ...nu, source: SOURCE, adapteDe: ADAPTE }).success).toBe(false);
  });
});
