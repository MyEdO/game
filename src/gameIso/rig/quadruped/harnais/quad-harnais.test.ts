/**
 * SOCLE des SETS D'ÉQUIPEMENT quadrupèdes (#1128 L1) — deux contrats :
 *
 *  1. ÉTANCHÉITÉ du registre `harnais/defs/` : id kebab-case unique, gabarits DÉCLARÉS connus du
 *     registre d'espèces, clés de déco visant un os réel du gabarit (et une vue réelle). Le
 *     prédicat est PUR et mesuré d'abord sur des defs factices — valides ET fautives — puis appliqué
 *     au registre réel : une garde qui ne mordrait que sur le stock présent passerait à vide le jour
 *     où ce stock est vide.
 *  2. PIPELINE d'atelier : un dessin `<set>@<espèce>-<vue>.dessin.mts` compile sur le gabarit de
 *     l'espèce nommée, la sortie est IDEMPOTENTE, et sa désynchronisation fait ROUGIR `--check`
 *     (la porte de commit) — vert de nouveau après régénération PAR LE GÉNÉRATEUR.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { QUAD_HARNAIS, quadHarnaisDeco, harnaisOptions } from './index';
import type { QuadHarnaisDef } from './types';
import { buildQuadSkeleton, type QuadProps } from '../quadSkeleton';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../creatures';
import { creatures } from '../../../../data';
import { resolveById, planById, planOptsForRecord } from '../../bodyPlan';
import { bonesToSvg } from '../../renderBones';
import { resolveQuadFromProps, mergeQuadDeco } from '../composeQuad';
import { wingedPlan } from '../../winged/composeWing';
import { QUAD_REST } from '../quadPose';
import { buildTokenMap } from '../../palette';
import { quadDecoFragments } from '../quadParts';
import { MISSING_TONE } from '../../viewArt';

const SPECIES = { ...QUAD_SPECIES, ...WINGED_SPECIES };
/** Os RÉELS des gabarits (union sur toutes les espèces : les os d'aile n'existent que chez les ailés). */
const OS = new Set(Object.values(SPECIES).flatMap((p) => Object.keys(buildQuadSkeleton(p))));
const VUES = new Set(['profile', 'front', 'back']);

/** Violations du contrat d'un set — liste VIDE = def étanche. */
function violations(d: QuadHarnaisDef): string[] {
  const v: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.id)) v.push(`id non kebab-case : « ${d.id} »`);
  if (!d.especes.length) v.push(`${d.id} : aucun gabarit déclaré`);
  for (const e of d.especes) if (!(e in SPECIES)) v.push(`${d.id} : gabarit inconnu « ${e} »`);
  for (const cle of Object.keys(d.deco)) {
    const [os, vue] = cle.split('#');
    if (!OS.has(os)) v.push(`${d.id} : os inconnu « ${os} »`);
    if (vue !== undefined && !VUES.has(vue)) v.push(`${d.id} : vue inconnue « ${vue} »`);
  }
  return v;
}

const set = (over: Partial<QuadHarnaisDef> = {}): QuadHarnaisDef => ({
  id: 'sellerie-factice',
  label: 'Sellerie factice',
  especes: ['cheval'],
  deco: { tronc: '<path d="M0 0 L1 1 Z" fill="@corps"/>', 'tete#profile': '<path d="M0 0 L1 1 Z" fill="@corps"/>' },
  ...over,
});

describe('registre des sets d\'équipement quadrupèdes : étanchéité', () => {
  it('une def conforme ne lève AUCUNE violation', () => {
    expect(violations(set())).toEqual([]);
  });

  it('id non kebab-case, gabarit inconnu, gabarits vides, os ou vue inconnus sont REFUSÉS', () => {
    expect(violations(set({ id: 'Sellerie_Imperiale' }))).toContain('id non kebab-case : « Sellerie_Imperiale »');
    expect(violations(set({ especes: ['licorne-de-verre'] }))).toContain('sellerie-factice : gabarit inconnu « licorne-de-verre »');
    expect(violations(set({ especes: [] }))).toContain('sellerie-factice : aucun gabarit déclaré');
    expect(violations(set({ deco: { selle: '<path/>' } as QuadHarnaisDef['deco'] })))
      .toContain('sellerie-factice : os inconnu « selle »');
    expect(violations(set({ deco: { 'tronc#trois-quarts': '<path/>' } as QuadHarnaisDef['deco'] })))
      .toContain('sellerie-factice : vue inconnue « trois-quarts »');
  });

  it('le registre réel est étanche, et sa table est keyée par l\'`id` de chaque def', () => {
    const defs = Object.values(QUAD_HARNAIS);
    expect(defs.flatMap(violations)).toEqual([]);
    for (const [cle, d] of Object.entries(QUAD_HARNAIS)) expect(cle).toBe(d.id);
    expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
  });
});

// ── pipeline d'atelier : dessin de set → compilé, sous la porte `--check` ─────────────────────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SET = 'set-factice-l1';
// `tsx` se résout par le sous-chemin EXPORTÉ `tsx/cli` — jamais par un chemin `node_modules/` collé
// à la racine de l'arbre. Cette résolution REMONTE les dossiers parents (#1679 L1c-M3) : hors du
// chemin `npm test`, qui refuse en amont un outillage non local, elle servirait le tsx d'un AUTRE
// arbre. Un chemin résolu hors de ROOT est donc refusé ici, en le nommant.
const TSX = (() => {
  const resolu = createRequire(import.meta.url).resolve('tsx/cli');
  if (!resolve(resolu).startsWith(resolve(ROOT) + sep))
    throw new Error(`tsx résolu hors de cet arbre : ${resolu} — node_modules local absent`);
  return resolu;
})();

/**
 * Le pipeline tourne dans un BAC À SABLE hors de l'arbre (`QUAD_RIG_RACINE`, cf.
 * `scripts/rig/compile-dessin-quad.mts`) : dessin et compilé sont des fichiers TRANSITOIRES, et
 * `src/` est scanné en parallèle par les gardes de corpus (walkers de `src/name-field-guard.test.ts`,
 * `src/ui/registry-id-branch-guard.test.ts`, `src/engine/rule-refs.test.ts`). Le gabarit, lui, reste
 * lu du moteur réel : c'est bien `boeuf` du registre d'espèces qui est cuit.
 */
const compilateurDe = (racine: string) => (...args: string[]) =>
  spawnSync(process.execPath, [TSX, join(ROOT, 'scripts/rig/compile-dessin-quad.mts'), ...args],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, QUAD_RIG_RACINE: racine } });
const md5 = (f: string) => createHash('md5').update(readFileSync(f)).digest('hex');

describe('compilation d\'un dessin de SET (gabarit lu du suffixe @espèce)', () => {
  it('compile, reste idempotent, ROUGIT à la désynchro et REVERDIT après régénération', () => {
    const BAC = mkdtempSync(join(tmpdir(), 'quad-harnais-'));
    const DESSIN = join(BAC, 'atelier', 'harnais', `${SET}@boeuf-profil.dessin.mts`);
    const COMPILE = join(BAC, 'harnais', 'setFacticeL1ProfilCompile.ts');
    const compilateur = compilateurDe(BAC);
    mkdirSync(dirname(DESSIN), { recursive: true });
    writeFileSync(DESSIN, [
      '/** Fixture de test (#1128 L1) — écrite et supprimée par quad-harnais.test.ts. */',
      'export interface GroupeDessin { bone: string; svg: string }',
      'export const DESSIN: GroupeDessin[] = [',
      '  { bone: \'tronc\', svg: \'<path d="M40 80 L70 80 L70 92 L40 92 Z" fill="@corps"/>\' },',
      '  { bone: \'tete\', svg: \'<path d="M88 62 L98 62 L98 70 L88 70 Z" fill="@corps"/>\' },',
      '];',
      '',
    ].join('\n'));
    try {
      const un = compilateur(SET);
      expect(un.stderr + un.stdout).toContain(`harnais/${SET}@boeuf-profil.dessin.mts`);
      expect(un.status).toBe(0);
      expect(existsSync(COMPILE), 'la sortie du set vit sous quadruped/harnais/').toBe(true);

      const texte = readFileSync(COMPILE, 'utf8');
      expect(texte).toContain('export const SET_FACTICE_L1_PROFIL_COMPILE: Record<string, string> = {');
      expect(texte).toContain(`depuis atelier/harnais/${SET}@boeuf-profil.dessin.mts`);
      // Cuisson monde → local effectuée : les coordonnées du dessin ne survivent pas telles quelles.
      expect(texte).not.toContain('M40 80');
      expect(texte).toMatch(/^ {2}tronc: "/m);
      expect(texte).toMatch(/^ {2}tete: "/m);

      const empreinte = md5(COMPILE);
      expect(compilateur(SET).status, 'seconde compilation').toBe(0);
      expect(md5(COMPILE), 'idempotence : même dessin → même octet').toBe(empreinte);
      expect(compilateur('--check', SET).status, '--check sur un compilé à jour').toBe(0);

      // DÉSYNCHRO d'un octet du compilé → la porte doit refuser.
      writeFileSync(COMPILE, `${readFileSync(COMPILE, 'utf8')} `);
      const rouge = compilateur('--check', SET);
      expect(rouge.status, '--check sur un compilé désynchronisé').toBe(1);
      expect(rouge.stderr).toContain('sortie(s) divergentes du dessin');

      // Remise en état PAR LE GÉNÉRATEUR (jamais une restauration à la main). L'écriture de
      // `scripts/rig/compile-dessin-quad.mts:189` est CONDITIONNELLE (`actuel !== texte`) :
      // l'idempotence ci-dessus prend la branche « inchangé », ce passage-ci est le seul qui
      // prend la branche qui ÉCRIT sur une destination existante.
      expect(compilateur(SET).status, 'régénération après désynchro').toBe(0);
      expect(md5(COMPILE), 'empreinte retrouvée').toBe(empreinte);
    } finally {
      rmSync(BAC, { recursive: true, force: true });
    }
  }, 180_000);
});

// ── SERVICE du set à la DONNÉE committée (#1128 L3) ──────────────────────────────────────────
/** Jetons de palette d'un SVG — MÊME lecture que `applyTokenMap` (un jeton hors table y est un
 *  no-op SILENCIEUX : l'art sort avec « @sellerieCuir » en valeur de `fill`). */
const jetons = (svg: string): string[] => [...svg.matchAll(/@([a-zA-Z]\w*)/g)].map((m) => m[1]);

/** Les records de `creatures.json` qui déclarent un set, avec l'espèce que le rendu leur résout. */
const recordsHarnaches = () =>
  creatures.filter((c) => c.appearance?.harnais).map((c) => ({
    id: c.id,
    harnais: c.appearance!.harnais!,
    espece: resolveById(c.id).species,
    colors: c.appearance?.colors,
  }));

describe('donnée COMMITTÉE : un record harnaché est réellement servi (#1128 L3)', () => {
  it('la mesure porte sur une population réelle', () => {
    expect(recordsHarnaches().length, 'aucun record ne déclare de set : la garde passerait à vide').toBeGreaterThan(0);
  });

  it('chaque `appearance.harnais` vise un set du registre, CUIT pour l\'espèce du porteur', () => {
    const fautes: string[] = [];
    for (const { id, harnais, espece } of recordsHarnaches()) {
      const set = QUAD_HARNAIS[harnais];
      if (!set) { fautes.push(`${id} : set « ${harnais} » absent du registre`); continue; }
      if (!set.especes.includes(espece))
        fautes.push(`${id} : set « ${harnais} » non cuit pour « ${espece} » (déclarées : ${set.especes.join(', ')})`);
    }
    expect(fautes, 'record harnaché que le registre ne peut pas servir').toEqual([]);
  });

  it('chaque jeton de l\'art du set existe dans la palette EFFECTIVE du porteur', () => {
    const fautes: string[] = [];
    let mesures = 0;
    for (const { id, harnais, espece, colors } of recordsHarnaches()) {
      const set = QUAD_HARNAIS[harnais], p = SPECIES[espece];
      if (!set || !p) continue;
      const tmap = buildTokenMap([p.palette], colors ?? {});
      for (const [cle, val] of Object.entries(set.deco)) {
        if (!val) continue;
        for (const f of quadDecoFragments(val))
          for (const j of jetons(f.svg)) {
            mesures++;
            if (!(j in tmap)) fautes.push(`${id} (${espece}) ${harnais} ${cle} : jeton « @${j} » absent de la palette`);
          }
      }
    }
    expect(mesures, 'population des jetons mesurés').toBeGreaterThan(0);
    expect([...new Set(fautes)], 'jeton sans hex : `applyTokenMap` le laisse tel quel, EN SILENCE').toEqual([]);
  });
});

// ── REFUS BRUYANT d'un set non servi (patron du repli visible #223) ──────────────────────────
describe('un set que le registre ne peut pas servir est REFUSÉ, visiblement (#1128 L3)', () => {
  afterEach(() => vi.restoreAllMocks());
  const alarme = (deco: NonNullable<QuadProps['deco']>): boolean =>
    Object.values(deco).flatMap((v) => quadDecoFragments(v!)).some((f) => f.svg.includes(MISSING_TONE));

  it('id inconnu du registre → silhouette d\'alarme + avertissement nommant l\'id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(alarme(quadHarnaisDeco('bat-de-mule-inexistant', 'cheval'))).toBe(true);
    expect(warn.mock.calls.flat().join(' ')).toContain('bat-de-mule-inexistant');
  });

  it('espèce hors des `especes` déclarées → alarme + avertissement nommant le set ET l\'espèce', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(alarme(quadHarnaisDeco('sellerie-imperiale', 'ours'))).toBe(true);
    const msg = warn.mock.calls.flat().join(' ');
    expect(msg).toContain('sellerie-imperiale');
    expect(msg).toContain('ours');
  });

  it('set servi → la déco du set, aucune alarme, aucun avertissement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deco = quadHarnaisDeco('sellerie-imperiale', 'cheval');
    expect(deco).toBe(QUAD_HARNAIS['sellerie-imperiale'].deco);
    expect(alarme(deco)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('le sélecteur d\'authoring offre le registre, rien d\'autre', () => {
    expect(harnaisOptions().map((o) => o.id)).toEqual(Object.values(QUAD_HARNAIS).map((d) => d.id));
  });
});

// ── ÉQUIVALENCE record → rendu (la sonde du dessin, figée) ───────────────────────────────────
/**
 * Le CÂBLAGE bout-en-bout, mesuré sur le chemin de PROD d'un record (`resolveById` +
 * `planOptsForRecord` + `plan.resolve`) : une bête harnachée par la DONNÉE rend exactement
 * l'espèce NUE avec la déco du set poussée à la main — la sonde qui a prouvé l'extraction L2
 * (recollage byte-identique), désormais rejouable pour tout set futur. Contrôle NÉGATIF sur la
 * même population : un record sans `harnais` rend la bête nue, et les deux rendus diffèrent.
 */
describe('un record harnaché rend l\'espèce NUE + la déco du set (#1128 L3)', () => {
  const svgDuRecord = (id: string): string => {
    const r = resolveById(id);
    return bonesToSvg(planById(r.plan).resolve(r.species, 'profile', QUAD_REST, planOptsForRecord(id)));
  };
  const svgDeProps = (deco?: NonNullable<QuadProps['deco']>): string =>
    bonesToSvg(resolveQuadFromProps({ ...QUAD_SPECIES.cheval, deco }, 'profile', QUAD_REST));

  it('les 3 montures de carrière rendent le cheval + la sellerie ; les nues rendent le cheval nu', () => {
    const attendu = svgDeProps(QUAD_HARNAIS['sellerie-imperiale'].deco);
    const nu = svgDeProps();
    expect(attendu).not.toBe(nu); // la sellerie pèse dans le markup : la comparaison n'est pas vide
    for (const id of ['cheval-de-monte', 'cheval-de-guerre-leger', 'destrier-cheval-de-guerre-lourd'])
      expect(svgDuRecord(id), id).toBe(attendu);
    for (const id of ['cheval', 'poulain', 'mule'])
      expect(svgDuRecord(id), id).toBe(nu);
  });
});

/**
 * Le gabarit AILÉ est un quadrupède + ailes : il passe par le MÊME pipeline
 * (`resolveQuadFromProps`), son catalogue d'espèces est mesuré par les mêmes gardes, et un set peut
 * DÉCLARER une espèce ailée (`especes`, prédicat L1). Le canal doit donc lui arriver aussi : sinon
 * un record ailé harnaché passe les trois gardes de donnée au VERT et rend NU, en silence.
 * Mesure sur les deux issues possibles — servi, ou REFUSÉ visiblement — jamais ignoré.
 */
describe('le canal atteint AUSSI le gabarit ailé (#1128 L3)', () => {
  afterEach(() => vi.restoreAllMocks());
  const rendu = (harnais?: string): string =>
    bonesToSvg(wingedPlan.resolve('pegase', 'profile', wingedPlan.restPose(), { harnais }));

  it('un set déclaré par la donnée ARRIVE au rendu ailé', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nu = rendu();
    // `sellerie-imperiale` n'est cuite que pour `cheval` : sur une autre carrure, l'issue attendue
    // est le REFUS VISIBLE — ce qui prouve l'arrivée du canal aussi sûrement qu'un set servi.
    const avec = rendu('sellerie-imperiale');
    expect(avec, 'le set n\'atteint pas le gabarit ailé : la bête rendrait NUE, en silence').not.toBe(nu);
    expect(avec).toContain(MISSING_TONE);
    expect(nu).not.toContain(MISSING_TONE);
  });
});

// ── FUSION `deco` espèce ⊕ set (contrat propre de `mergeQuadDeco`) ───────────────────────────
describe('mergeQuadDeco : le set S\'AJOUTE à la déco d\'espèce (#1128 L3)', () => {
  const A = '<g data-x="espece"/>', B = '<g data-x="set"/>';

  it('clé de collision : les fragments de l\'espèce restent, ceux du set viennent APRÈS', () => {
    const out = mergeQuadDeco({ 'tronc#profile': [{ svg: A, plan: -1 }] }, { 'tronc#profile': [{ svg: B, plan: 0 }] });
    expect(out['tronc#profile']).toEqual([{ svg: A, plan: -1 }, { svg: B, plan: 0 }]);
  });

  it('SVG nu des deux côtés : la valeur devient une liste de fragments, dans le même ordre', () => {
    expect(mergeQuadDeco({ tronc: A }, { tronc: B })).toEqual({ tronc: [{ svg: A }, { svg: B }] });
  });

  it('clé sans collision : elle entre TELLE QUELLE, et la déco d\'espèce est intacte', () => {
    const base = { 'tete#profile': A };
    const out = mergeQuadDeco(base, { 'tronc#profile': [{ svg: B, plan: 0 }] });
    expect(out['tete#profile']).toBe(A);
    expect(out['tronc#profile']).toEqual([{ svg: B, plan: 0 }]);
    expect(base).toEqual({ 'tete#profile': A }); // PURE : l'entrée n'est pas mutée
  });

  it('clé nue et clé `os#vue` COEXISTENT (ce sont deux clés, jamais une collision)', () => {
    const out = mergeQuadDeco({ tronc: A }, { 'tronc#profile': B });
    expect(out.tronc).toBe(A);
    expect(out['tronc#profile']).toBe(B);
  });

  it('sur une espèce qui porte DÉJÀ de la déco (sanglier), rien de l\'espèce n\'est perdu', () => {
    const espece = QUAD_SPECIES.sanglier;
    expect(Object.keys(espece.deco ?? {}).length, 'espèce sans déco : la mesure serait vide').toBeGreaterThan(0);
    const out = mergeQuadDeco(espece.deco, QUAD_HARNAIS['sellerie-imperiale'].deco);
    for (const [cle, val] of Object.entries(espece.deco!)) {
      const fusion = quadDecoFragments(out[cle as keyof typeof out]!);
      expect(fusion.slice(0, quadDecoFragments(val!).length), cle).toEqual(quadDecoFragments(val!));
    }
    expect(Object.keys(out).length).toBe(new Set([...Object.keys(espece.deco!), ...Object.keys(QUAD_HARNAIS['sellerie-imperiale'].deco)]).size);
  });
});

// ── `''` = NU EXPLICITE d'un override d'instance ─────────────────────────────────────────────
describe('override d\'instance : `harnais: \'\'` DÉSHABILLE le record (#1128 L3)', () => {
  const svg = (id: string, over?: Parameters<typeof planOptsForRecord>[1]): string => {
    const r = resolveById(id);
    return bonesToSvg(planById(r.plan).resolve(r.species, 'profile', QUAD_REST, planOptsForRecord(id, over)));
  };

  it('le record harnaché rendu avec `harnais: \'\'` est la bête NUE ; sans override, il reste sellé', () => {
    const nu = svg('cheval');
    expect(svg('cheval-de-monte')).not.toBe(nu);
    expect(planOptsForRecord('cheval-de-monte', { harnais: '' }).harnais).toBe('');
    expect(svg('cheval-de-monte', { harnais: '' })).toBe(nu);
  });
});
