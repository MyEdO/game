/**
 * PARSE DE MESURE (`reperesDuParse`, `grammaire/ref.ts`) — le côté DÉCLARÉ du volet SLOTS
 * (`docs/structures-donnees.md` §6) est ce que `idDe` valide au parse (#1473 R1). Ce banc tient :
 *  - le PATH de donnée de chaque repère, à travers la récursion (`z.lazy`), l'union (première branche
 *    propre), la clé de record, et le report d'une issue de payload d'op (`gameOpSchema`) ;
 *  - la BORNE du mode : aucun parse hors `reperesDuParse` n'émet de repère, même quand il lève ;
 *  - la GARDE DU MASQUAGE : sur les documents des deux racines, aucun nœud ne fait perdre au parse de
 *    mesure une référence que le parse normal valide.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { estFeuilleDId, familleDuRepere, idDe, mesureDuParse, reperesDuParse } from './ref';
import { famillesConstruites, gameOpSchema } from './mecanique';
import { refTestDeCorruption } from './valeurs';
import { descendre } from './descente';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import { DEFS_DE_DOCUMENT } from '../validate';
import { scannerDonnees } from '../../../../scripts/docs/lib/structures-scan.mjs';

const COMPETENCE = IDS_PAR_ESPACE['skills.json'][0];
const TALENT = IDS_PAR_ESPACE['talents.json'][0];
const TRAIT = IDS_PAR_ESPACE['traits.json'][0];
const POSTE = IDS_PAR_ESPACE['ship-stations.json'][0];

type Flux = { skill?: string; steps?: Flux[] };
const flux: z.ZodType<Flux> = z.lazy(() => z.strictObject({ skill: idDe('skill').optional(), steps: z.array(flux).optional() }));

describe('reperesDuParse — le path de DONNÉE de chaque référence validée par `idDe`', () => {
  it('RÉCURSION : un flux imbriqué sur deux niveaux rend chaque `skill` à son path', () => {
    const donnee = { skill: COMPETENCE, steps: [{ steps: [{ skill: COMPETENCE }] }] };
    expect(reperesDuParse(flux, donnee)).toEqual([
      { path: ['skill'], type: 'skill', parCle: false },
      { path: ['steps', 0, 'steps', 0, 'skill'], type: 'skill', parCle: false },
    ]);
  });

  it('PAYLOAD D’OP : le repère traverse le re-parse de `gameOpSchema`, à son path dans l’op', () => {
    expect(reperesDuParse(z.array(gameOpSchema), [{ op: 'domeWard', traitId: TRAIT, indice: 1 }])).toEqual([
      { path: [0, 'traitId'], type: 'trait', parCle: false },
    ]);
  });

  it('REPORT D’UNE ISSUE DE PAYLOAD : `gameOpSchema` garde son `code`, son `path` et ses `params`', () => {
    const r = gameOpSchema.safeParse({ op: 'domeWard', traitId: 3, indice: 1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => ({ code: i.code, path: i.path }))).toEqual([{ code: 'invalid_type', path: ['traitId'] }]);
    // Les `params` sont ceux du repère : sans eux, le type du slot se perdrait au report.
    expect(reperesDuParse(gameOpSchema, { op: 'domeWard', traitId: TRAIT, indice: 1 }).map((r) => r.type)).toEqual(['trait']);
  });

  it('UNION : seule la PREMIÈRE branche propre compte — celle que le parse normal choisit', () => {
    // Les deux branches sont propres, et la seconde rend un repère de plus : le parse normal prend la
    // branche 0 (objet ouvert), où `b` n'est validé contre aucun registre.
    const u = z.union([z.looseObject({ a: idDe('skill') }), z.strictObject({ a: idDe('skill'), b: idDe('talent') })]);
    expect(u.safeParse({ a: COMPETENCE, b: 'zzz-inconnu' }).success).toBe(true);
    expect(reperesDuParse(u, { a: COMPETENCE, b: TALENT })).toEqual([{ path: ['a'], type: 'skill', parCle: false }]);
    // Une branche en FAUTE qui précède n'est pas propre : la première branche PROPRE est la seconde.
    const v = z.union([z.strictObject({ k: z.number() }), z.strictObject({ k: idDe('skill') })]);
    expect(reperesDuParse(z.array(v), [{ k: 1 }, { k: COMPETENCE }])).toEqual([{ path: [1, 'k'], type: 'skill', parCle: false }]);
  });

  it('CLÉ DE RECORD : la référence portée par une clé est rendue `parCle`', () => {
    expect(reperesDuParse(z.record(idDe('shipStation'), z.number()), { [POSTE]: 3 })).toEqual([{ path: [POSTE], type: 'shipStation', parCle: true }]);
  });

  it('une donnée INVALIDE au parse normal LÈVE en nommant le path — jamais un slot en moins en silence', () => {
    expect(() => reperesDuParse(flux, { steps: [{ skill: 'zzz-inconnue' }] })).toThrow(/« custom » à « steps\.0\.skill »/);
  });

  it('un RAFFINEMENT posé en SORTIE de la feuille est jugé au parse normal : hors borne LÈVE, dans la borne rend son slot', () => {
    expect(() => reperesDuParse(refTestDeCorruption, { id: 'athletisme' })).toThrow(/« custom » à « id » \(corruptionExposure\.skill : « athletisme »/);
    expect(reperesDuParse(refTestDeCorruption, { id: 'resistance' })).toEqual([{ path: ['id'], type: 'skill', parCle: false }]);
  });
});

describe('le mode de mesure est BORNÉ à l’appel de `reperesDuParse`', () => {
  it('aucun parse ordinaire n’émet de repère, avant comme après une mesure — y compris une mesure qui lève', () => {
    const feuille = idDe('skill');
    expect(feuille.safeParse(COMPETENCE).success).toBe(true);
    expect(reperesDuParse(feuille, COMPETENCE)).toHaveLength(1);
    expect(feuille.safeParse(COMPETENCE).success).toBe(true);
    expect(() => reperesDuParse(feuille, 'zzz-inconnue')).toThrow();
    expect(feuille.safeParse(COMPETENCE).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'domeWard', traitId: TRAIT, indice: 1 }).success).toBe(true);
  });
});

// ============================================================================
// GARDE DU MASQUAGE. Au parse de mesure, une validation réussie d'`idDe` rend une issue (le repère) :
// tout nœud dont le parse dépend de la présence d'une issue chez un enfant peut perdre ce repère. Chaque
// document est parsé deux fois (normal, mesure) sous des schémas instrumentés LE TEMPS DU TEST, rien
// n'étant posé dans le code de production. Trois fautes, nommées par le path de schéma du nœud :
//  - AVALEMENT : un nœud rend un résultat sans issue alors qu'un enfant lui a rendu des repères seuls ;
//  - SAUT : une feuille validée au parse normal n'est plus exécutée au parse de mesure ;
//  - COUVERTURE : un repère rendu vient d'une feuille que la marche instrumentée n'a pas atteinte.
// Les deux familles de repère y passent : la référence (feuille `idDe`) et le nœud d'op (`emetteursDOp`,
// `marquerOpAtteinte`), chacune reconnue par `familleDuRepere`.
// ============================================================================

/** Les nœuds qui émettent le repère d'op : le côté `in` du `gameOp` de CHAQUE famille construite
 *  (`famillesConstruites`, `grammaire/mecanique.ts`), qui porte le `superRefine`. */
const emetteursDOp = (): ReadonlySet<object> => new Set(famillesConstruites().map((f) => (f.gameOp as unknown as z.ZodPipe).in));

type Issue = { readonly code: string; readonly params?: object; readonly errors?: readonly (readonly Issue[])[]; readonly issues?: readonly Issue[] };
type Charge = { value: unknown; issues: Issue[] };
type Run = (charge: Charge, ctx: unknown) => Charge;
type AvecRun = { _zod: { run: Run } };

/** Chaque nœud atteint depuis les racines, une fois, avec le premier path de schéma qui l'atteint. */
function noeudsAtteints(racines: readonly (readonly [string, unknown])[]): Map<object, string> {
  const vus = new Map<object, string>();
  descendre(
    racines.map(([, s]) => s),
    ({ noeud, path, racine }) => void vus.set(noeud, racines[racine][0] + path),
  );
  return vus;
}

interface Sonde {
  mesure: boolean;
  pile: boolean[][];
  validees: { normal: Map<string, number>; mesure: Map<string, number> };
  emis: WeakSet<object>;
  nbEmis: number;
  nbOpsEmis: number;
  avalements: string[];
}

/** Instrumente les nœuds atteints depuis les racines ; rend la sonde et la remise à l'identique. */
function instrumenter(racines: readonly (readonly [string, unknown])[]): { sonde: Sonde; restaurer: () => void } {
  const sonde: Sonde = { mesure: false, pile: [], validees: { normal: new Map(), mesure: new Map() }, emis: new WeakSet(), nbEmis: 0, nbOpsEmis: 0, avalements: [] };
  const estPropre = (i: Issue): boolean =>
    (i.params !== undefined && sonde.emis.has(i.params)) ||
    (i.code === 'invalid_union' && (i.errors ?? []).some((b) => b.length > 0 && b.every(estPropre))) ||
    ((i.code === 'invalid_key' || i.code === 'invalid_element') && (i.issues ?? []).length > 0 && i.issues!.every(estPropre));
  const originaux: [AvecRun['_zod'], Run][] = [];
  const emetteurs = emetteursDOp();
  for (const [noeud, nom] of noeudsAtteints(racines)) {
    const zod = (noeud as AvecRun)._zod;
    const run = zod.run;
    originaux.push([zod, run]);
    const feuille = estFeuilleDId(noeud);
    const emetteurDOp = emetteurs.has(noeud);
    zod.run = (charge, ctx) => {
      const avant = charge.issues.length;
      const valeur = charge.value;
      sonde.pile.push([]);
      let r: Charge;
      let enfants: boolean[];
      try {
        r = run(charge, ctx);
      } finally {
        enfants = sonde.pile.pop()!;
      }
      if (r instanceof Promise) throw new Error(`${nom} : parse ASYNC, hors du parse de mesure`);
      const nouvelles = r.issues.slice(avant);
      if (feuille) {
        const validee = sonde.mesure ? nouvelles.length > 0 && nouvelles.every((i) => i.params !== undefined) : nouvelles.length === 0;
        if (validee) {
          const cle = `${nom} « ${String(valeur)} »`;
          const compte = sonde.mesure ? sonde.validees.mesure : sonde.validees.normal;
          compte.set(cle, (compte.get(cle) ?? 0) + 1);
          if (sonde.mesure) {
            sonde.nbEmis += 1;
            for (const i of nouvelles) sonde.emis.add(i.params!);
          }
        }
      }
      if (emetteurDOp && sonde.mesure) {
        for (const i of nouvelles) {
          if (familleDuRepere(i.params) !== 'op' || sonde.emis.has(i.params!)) continue;
          sonde.emis.add(i.params!);
          sonde.nbOpsEmis += 1;
        }
      }
      if (sonde.mesure && nouvelles.length === 0 && enfants.some(Boolean)) sonde.avalements.push(nom);
      sonde.pile[sonde.pile.length - 1]?.push(sonde.mesure && nouvelles.length > 0 && nouvelles.every(estPropre));
      return r;
    };
  }
  return { sonde, restaurer: () => originaux.forEach(([zod, run]) => (zod.run = run)) };
}

/** Les fautes de masquage d'un document, sous des schémas instrumentés par `instrumenter`. */
function masquagesDe(sonde: Sonde, nom: string, schema: z.ZodType, donnee: unknown): string[] {
  Object.assign(sonde, { mesure: false, pile: [], validees: { normal: new Map(), mesure: new Map() }, nbEmis: 0, nbOpsEmis: 0, avalements: [] });
  if (!schema.safeParse(donnee).success) return [`${nom} : invalide au parse normal`];
  sonde.mesure = true;
  let rendus: ReturnType<typeof mesureDuParse>;
  try {
    rendus = mesureDuParse(schema, donnee);
  } catch (e) {
    return [`${nom} : ${(e as Error).message}`];
  } finally {
    sonde.mesure = false;
  }
  const fautes = sonde.avalements.map((n) => `${nom} AVALEMENT : ${n}`);
  for (const [cle, n] of sonde.validees.normal) {
    const m = sonde.validees.mesure.get(cle) ?? 0;
    if (m < n) fautes.push(`${nom} SAUT : ${cle} validée ${n}× au parse normal, ${m}× au parse de mesure`);
  }
  if (rendus.reperes.length > sonde.nbEmis) fautes.push(`${nom} COUVERTURE : ${rendus.reperes.length} repères rendus, ${sonde.nbEmis} émis par les feuilles instrumentées`);
  if (rendus.ops.length > sonde.nbOpsEmis) fautes.push(`${nom} COUVERTURE : ${rendus.ops.length} nœuds d’op rendus, ${sonde.nbOpsEmis} émis par le nœud d’op instrumenté`);
  return fautes;
}

/** Les fautes de masquage d'un témoin : son schéma seul est instrumenté. */
function masquagesDuTemoin(schema: z.ZodType, donnee: unknown): string[] {
  const { sonde, restaurer } = instrumenter([['témoin', schema]]);
  try {
    return masquagesDe(sonde, 'témoin', schema, donnee);
  } finally {
    restaurer();
  }
}

describe('GARDE DU MASQUAGE — aucun nœud ne perd au parse de mesure une référence que le parse normal valide', () => {
  it('A — union dont une branche postérieure NON permissive accepte la donnée', () => {
    const s = z.union([z.strictObject({ k: idDe('skill') }), z.strictObject({ k: z.string() })]);
    expect(masquagesDuTemoin(s, { k: COMPETENCE })).toEqual(['témoin AVALEMENT : témoin']);
  });

  it('B — union dont la branche postérieure est une chaîne CONTRAINTE', () => {
    expect(masquagesDuTemoin(z.union([idDe('skill'), z.string().min(1)]), COMPETENCE)).toEqual(['témoin AVALEMENT : témoin']);
  });

  it('C — union dont la branche postérieure est une chaîne FACULTATIVE', () => {
    const s = z.strictObject({ k: z.union([idDe('skill'), z.string().optional()]) });
    expect(masquagesDuTemoin(s, { k: COMPETENCE })).toEqual(['témoin AVALEMENT : témoin.k']);
  });

  it('D — record dont la clé ET la valeur portent une référence : la valeur n’est plus parsée', () => {
    const s = z.record(idDe('shipStation'), z.strictObject({ s: idDe('skill') }));
    expect(masquagesDuTemoin(s, { [POSTE]: { s: COMPETENCE } })).toEqual([
      `témoin SAUT : témoin{}.s « ${COMPETENCE} » validée 1× au parse normal, 0× au parse de mesure`,
    ]);
  });

  it('E — `.catch` au-dessus d’une feuille `idDe`', () => {
    const s = z.strictObject({ k: idDe('skill').catch(COMPETENCE as never) });
    expect(masquagesDuTemoin(s, { k: COMPETENCE })).toEqual(['témoin AVALEMENT : témoin.k']);
  });

  it('F — pipe dont le côté `in` et le côté `out` portent une référence : le côté `out` avorte', () => {
    const s = z.strictObject({ a: idDe('skill'), b: z.string() }).pipe(z.strictObject({ a: z.string(), b: idDe('skill') }) as never);
    expect(masquagesDuTemoin(s, { a: COMPETENCE, b: COMPETENCE })).toEqual([
      `témoin SAUT : témoin.b « ${COMPETENCE} » validée 1× au parse normal, 0× au parse de mesure`,
    ]);
  });

  it('G — union dont une branche postérieure OPAQUE avale un nœud d’op atteint', () => {
    const s = z.union([z.array(gameOpSchema), z.array(z.unknown())]);
    expect(masquagesDuTemoin(s, [{ op: 'condition', id: 'a' }])).toEqual(['témoin AVALEMENT : témoin']);
  });

  it('les documents des DEUX racines n’en portent aucun (payloads de CHAQUE famille mécanique compris, re-parsés par son `gameOp`)', () => {
    const racine = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const { brutParNom } = scannerDonnees(racine);
    const documents = DEFS_DE_DOCUMENT.filter((d) => brutParNom.has(d.file));
    expect(documents.length).toBeGreaterThan(100);
    const { sonde, restaurer } = instrumenter([
      ...DEFS_DE_DOCUMENT.map((d) => [d.file, d.schema] as const),
      ...famillesConstruites().flatMap((f) => Object.entries(f.opDefs).map(([op, s]) => [`${JSON.stringify(f.regimes)}.${op}`, s] as const)),
    ]);
    try {
      expect(documents.flatMap((d) => masquagesDe(sonde, d.file, d.schema, brutParNom.get(d.file)))).toEqual([]);
    } finally {
      restaurer();
    }
  });
});
