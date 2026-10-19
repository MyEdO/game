#!/usr/bin/env -S npx tsx
/**
 * `npm run map:check -- <clé|chemin/projet.json> [--carte]` — outil de CONTRÔLE DE CARTE : rapporte
 * chaque défaut de plan. Vérité géométrique = la Scène COMPILÉE (registre : `buildScene` ; projet
 * exporté : la Scène du document, relue par `parseProject`). Ne corrige RIEN.
 *
 * Deux façons de désigner une carte, un seul rapport :
 *   npm run map:check -- opera                              (clé du registre : position FICHIER:LIGNE:COLONNE
 *   npm run map:check -- opera --carte                       dans la grille ASCII source + extrait, curseur `^`)
 *   npm run map:check -- src/scenes/diligence/diligence-projet.json
 *                                                           (projet exporté par l'éditeur : COORDONNÉES de case,
 *                                                            aucune grille ASCII n'existant derrière)
 */
import { auditStairwells, builtTerrains, floorPairs, PLAN_DEFECT_FAMILIES, scenePlanDefects, scenesZ, terrainAt, type PlanDefect, type PlanDefectFamily, type PlanDefectFamilyDef } from '../../src/state/planDefects';
import { estAbsent } from '../../src/noyau/monde/terrain';
import { codedSites, coord, projectSites, type Site } from './sites';
import { findMaps, MAP_REGISTRY, type MapEntry } from './registry';

const [, , sceneArg, ...rest] = process.argv;
const withCarte = rest.includes('--carte');

if (!sceneArg) {
  console.error(`Usage : npm run map:check -- <clé|chemin/projet.json> [--carte]`);
  console.error(`Clés du registre : ${MAP_REGISTRY.map((m) => m.key).join(', ')}`);
  console.error(`Projet exporté : passer le CHEMIN du .json (toutes ses scènes sont contrôlées).`);
  process.exit(1);
}

/** Numéro de rubrique = rang dans `PLAN_DEFECT_FAMILIES` (source unique des titres et des sujets,
 *  `state/planDefects`) — la numérotation est un fait d'AFFICHAGE, elle ne vit pas en donnée. */
const familyNo = (id: PlanDefectFamily) => PLAN_DEFECT_FAMILIES.findIndex((f) => f.id === id) + 1;

function report(entry: MapEntry): void {
  const scene = entry.build();
  const sites = entry.source ? codedSites(entry.source) : projectSites(entry, scene);
  const stairChars = entry.source?.stairChars;

  const pairs = floorPairs(scene);
  const allDefects = scenePlanDefects(scene);
  const allTremies: ReturnType<typeof auditStairwells> = [];
  for (const [aboveZ, belowZ] of pairs)
    allTremies.push(...auditStairwells(scene, aboveZ, belowZ, stairChars, (x, y) => sites.charAt(x, y, belowZ)));

  console.log(`=== Contrôle de carte — ${entry.label} (${entry.key}) ===`);
  console.log(sites.banner + '\n');

  const byFamily = new Map<PlanDefectFamily, PlanDefect[]>();
  for (const d of allDefects) {
    if (!byFamily.has(d.family)) byFamily.set(d.family, []);
    byFamily.get(d.family)!.push(d);
  }

  /** Imprime une rubrique et rend le nombre de défauts RÉELLEMENT localisés. Ceux qu'aucune grille
   *  source ne situe sont ANNONCÉS dans la rubrique elle-même : un « 0 » nu s'y lirait « rien à
   *  corriger » alors qu'il veut dire « rien de localisable ». */
  const printFamily = (def: PlanDefectFamilyDef): number => {
    const all = byFamily.get(def.id) ?? [];
    const located = all
      .map((d) => ({ d, site: sites.of(d) }))
      .filter((row): row is { d: PlanDefect; site: Site } => {
        if (row.site) return true;
        console.error(`[map:check] défaut « ${row.d.family} » ${coord(row.d.at)} sans position localisable dans la grille source — omis du rapport`);
        return false;
      });
    const omis = all.length - located.length;
    console.log(`${familyNo(def.id)}. ${def.title} — ${located.length}${omis ? ` (+ ${omis} NON LOCALISABLE(S) dans la grille source — à corriger quand même)` : ''}`);
    if (!located.length) { console.log(); return 0; }
    located.sort((a, b) => a.site.sort[0] - b.site.sort[0] || a.site.sort[1] - b.site.sort[1]);
    for (const { d, site } of located) {
      console.log(`  ${site.where}  — ${d.message}`);
      if (site.snippet) console.log(site.snippet);
    }
    console.log();
    return located.length;
  };

  const pairFamilies = PLAN_DEFECT_FAMILIES.filter((f) => f.scope === 'floorPair');
  const singleFloorFamilies = PLAN_DEFECT_FAMILIES.filter((f) => f.scope !== 'floorPair');
  const counts: Record<string, number> = {};

  // Les familles `floorPair` scannent une dalle d'étage CONTRE l'étage du dessous : sans second étage,
  // aucune n'a de sujet — y compris « mur manquant », dont le seul verdict au rez serait le bord de la
  // grille (mesuré : 180 arêtes sur `arene-hub` = exactement le périmètre 50×40, aucune case `vide`
  // intérieure). Un contrôle qui n'a rien regardé le DIT, il ne totalise pas zéro. TOUTES les autres
  // familles ont leur sujet dès le plain-pied — les zones déclarées (`zone`) comme la grille de murs
  // d'un seul étage (`floor`) : elles se rapportent quand même, et le scope les désigne sans liste en dur.
  if (!pairs.length) {
    console.log(`Familles ${pairFamilies.map((f) => familyNo(f.id)).join(', ')} — NON APPLICABLES : la scène n'a qu'un seul étage (z${scenesZ(scene).join(', z')}).\n`);
    for (const def of singleFloorFamilies) counts[def.id] = printFamily(def);
    console.log(`Aucun total : les familles d'étage n'ont pas été mesurées ici — ce rapport ne vaut pas quitus.\n`);
    if (withCarte) console.log(`Carte de superposition : rien à superposer.\n`);
    process.stderr.write(`[map:check] ${entry.key} un-seul-etage · familles de paire d'étages non applicables · ${JSON.stringify(counts)}\n`);
    return;
  }

  let total = 0;
  for (const def of PLAN_DEFECT_FAMILIES) total += printFamily(def);
  console.log(`TOTAL défauts : ${total}\n`);

  if (allTremies.length) {
    console.log(`${PLAN_DEFECT_FAMILIES.length + 1}. Trémies d'escalier (informatif — LÉGITIME, ne pas corriger) et trous suspects`);
    for (const t of allTremies) {
      const belowZ = pairs.find(([a]) => a === t.z)?.[1] ?? t.z - 1;
      console.log(`  ${t.legitimate ? 'TRÉMIE' : 'SUSPECT'}  ${sites.cell(t.x, t.y, belowZ).where}  ${t.detail}`);
    }
    console.log();
  }

  if (withCarte) {
    const [aboveZ, belowZ] = pairs[0];
    console.log(`=== Carte de superposition (z${aboveZ} sur z${belowZ}) ===`);
    console.log('# bâti aux deux étages · 1 étage seul · 0 rez bâti seul · , sol praticable · . vide\n');
    const batis = builtTerrains();
    const built = (t: string) => (entry.floorTerrain ? t === entry.floorTerrain : batis.has(t));
    const pave = (t: string) => (entry.floorTerrain ? t === entry.paveTerrain : !estAbsent(t) && !batis.has(t));
    for (let y = 0; y < scene.dimensions.h; y++) {
      let line = '';
      for (let x = 0; x < scene.dimensions.w; x++) {
        const e = !estAbsent(terrainAt(scene, x, y, aboveZ));
        const below = terrainAt(scene, x, y, belowZ);
        line += e && built(below) ? '#' : e ? '1' : built(below) ? '0' : pave(below) ? ',' : '.';
      }
      console.log(String(y).padStart(2) + ' ' + line);
    }
    console.log();
  }

  for (const def of PLAN_DEFECT_FAMILIES) counts[def.id] = (byFamily.get(def.id) ?? []).length;
  process.stderr.write(`[map:check] ${entry.key} ${JSON.stringify(counts)} · trémies=${allTremies.filter((t) => t.legitimate).length} · suspects=${allTremies.filter((t) => !t.legitimate).length}\n`);
}

for (const entry of findMaps(sceneArg)) report(entry);
