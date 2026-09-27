/**
 * RÉFÉRENCES DE DÉGRADÉ d'un rendu final (#1903 A4, D2). Question : un rendu final est-il entièrement
 * résolu, chaque `url(#id)` peint-il un dégradé qui existe, et chaque id défini deux fois l'est-il avec
 * le même contenu ?
 *  (0) aucun `@` ni `dg-` à `@` ne sort d'un rendu final ;
 *  (1) chaque `url(#id)` d'un rendu final vise un id de `defsGlobaux()` ou un id défini dans le même
 *      rendu ;
 *  (1') chaque `url(#id)` LITTÉRAL du source du rig (hors tests) vise un id de `defsGlobaux()`, un id
 *      défini dans le même fichier, ou un `dg-<forme>-…` dont la forme est dans `FORMES_DE_DEGRADE` avec
 *      autant d'arrêts que son arité ; un id interpolé (`${…}`) se vérifie au rendu, par (1) ;
 *  (2) dans un même rendu, un dégradé défini plusieurs fois l'est avec le même contenu (l'id d'un `dg-`
 *      est son contenu) ;
 *  (3) aucune définition `<linearGradient|radialGradient id=…>` dans l'art du rig hors `fxGradients.ts`
 *      et la résolution `dg-` (`palette.ts`).
 * Corpus : espèces × sexe × tenues × 3 vues, sans et avec surcharges extrêmes ; armes (avec et sans
 * skin), boucliers et armures portés ; créatures ; objets sans porteur (`objetSansPorteur`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { sexeSchema } from '../../../data/schemas/grammaire/valeurs';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { FORMES_DE_DEGRADE } from '../palette';
import { weaponPart, shieldPart, armourPart, objetSansPorteur } from './equipment';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { TENUE_DEFS } from './tenues/_registry.generated';
import { creatures } from '../../../data';
import { entityRigProfile } from '../enemyProfile';
import { planById, resolveById, planOptsForRecord } from '../bodyPlan';
import { asRigSpeciesId, type Appearance } from '../appearance';
import { defsGlobaux } from '../../sprites';
import { listerArbre } from '../../../../scripts/guards/lib/lister.mjs';
import { estFichierVitest } from '../../../../scripts/guards/lib/fichierVitest.mjs';
import type { ItemInstance, Weapon } from '../../../engine/types';
import type { PartArt } from './types';

const RIG = resolve(__dirname, '..');
const VUES = ['front', 'profile', 'back'] as const;
const LOCS = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];
const GLOBAUX = new Set([...defsGlobaux().matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const DEFINITION = /<(linear|radial)Gradient\b[^>]*\bid="([^"]+)"[^>]*>.*?<\/\1Gradient>/gs;
const ARO = /@[a-zA-Z]/;
const SURCHARGES: (Appearance['colors'] | undefined)[] = [
  undefined,
  { peau: '#000000', cheveux: '#ffffff', vet1: '#ff0000', vet2: '#00ff00', cuir: '#ffff00', metal: '#000000', yeux: '#ffffff' },
  { peau: '#ffffff', cheveux: '#000000', vet1: '#000000', vet2: '#ffffff', cuir: '#808080', metal: '#ffffff' },
];
const SKINS = [undefined, { metal: '#ff0000', cuir: '#00ff00', peau: '#123456' }];
const arme = (shape: string, skin?: Record<string, string>) =>
  ({ label: shape, type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], shape, ...(skin && { skin }) }) as unknown as Weapon;
const armure = (label: string, skin?: Record<string, string>) =>
  ({ uid: 'a', kind: 'armor', label, locs: LOCS, equipped: true, qualities: [], enc: 0, ...(skin && { skin }) }) as unknown as ItemInstance;
const MATIERES = ['Gambison', 'Jaque de cuir', 'Cotte de mailles', 'Plastron de plaque'];
const vues = (a: PartArt) => (typeof a === 'string' ? [a] : [a.front, a.back, a.profile].filter((v): v is string => v != null));

/** Fautes (0), (1) et (2) d'un corpus de rendus finaux. */
function fautesDeReferences(rendus: Iterable<[string, string]>): string[] {
  const fautes: string[] = [];
  for (const [cle, svg] of rendus) {
    if (ARO.test(svg)) fautes.push(`(0) \`@\` non résolu (${cle})`);
    const locaux = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const contenus = new Map<string, string>();
    for (const [def, , id] of svg.matchAll(DEFINITION)) {
      const vu = contenus.get(id);
      if (vu != null && vu !== def) fautes.push(`(2) ${id} : deux contenus (${cle})`);
      contenus.set(id, def);
    }
    for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g))
      if (!locaux.has(id) && !GLOBAUX.has(id)) fautes.push(`(1) url(#${id}) sans définition (${cle})`);
  }
  return [...new Set(fautes)];
}

function* corpus(): Generator<[string, string]> {
  const especes = (JSON.parse(readFileSync(resolve(__dirname, '../../../data/raceAppearance.json'), 'utf8')) as { id: string }[]).map((r) => asRigSpeciesId(r.id));
  for (const species of especes) for (const sex of sexeSchema.options) for (const { id: t } of TENUE_DEFS) for (const view of VUES)
    for (const [i, colors] of SURCHARGES.entries())
      yield [`perso|${species}|${sex}|${t}|${view}|s${i}`, bonesToSvg(resolveRig({ species, sex, build: 0.5, seed: 1, ...(colors && { colors }) }, { weapons: [], armour: [] }, {}, t, view))];
  for (const species of ['humain', 'nain'].map(asRigSpeciesId)) for (const view of VUES) for (const [i, colors] of SURCHARGES.entries()) {
    const app = { species, sex: 'M' as const, build: 0.5, seed: 1, ...(colors && { colors }) };
    for (const d of WEAPON_DEFS) for (const skin of SKINS)
      yield [`arme|${species}|${d.slug}|${view}|s${i}|${skin ? 'k' : ''}`, bonesToSvg(resolveRig(app, { weapons: [arme(d.slug, skin)], armour: [] }, {}, 'soldat', view))];
    for (const d of SHIELD_DEFS)
      yield [`bouclier|${species}|${d.slug}|${view}|s${i}`, bonesToSvg(resolveRig(app, { weapons: [arme('epee'), { ...arme(d.slug), label: 'Bouclier' }], armour: [] }, {}, 'soldat', view))];
    for (const l of MATIERES) for (const skin of SKINS) for (const t of ['soldat', 'nu'])
      yield [`armure|${species}|${l}|${t}|${view}|s${i}|${skin ? 'k' : ''}`, bonesToSvg(resolveRig(app, { weapons: [], armour: [armure(l, skin)] }, {}, t, view))];
  }
  for (const c of creatures) for (const view of VUES) {
    const r = resolveById(c.id);
    if (r.kind === 'rig') {
      const p = entityRigProfile(c.id, 7);
      if (p) yield [`creature|${c.id}|${view}`, bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, view))];
    } else {
      const plan = planById(r.plan);
      if (plan) yield [`creature|${c.id}|${view}`, bonesToSvg(plan.resolve(r.species, view, plan.restPose(), planOptsForRecord(c.id)))];
    }
  }
  for (const d of WEAPON_DEFS) for (const skin of SKINS)
    for (const [n, v] of vues(objetSansPorteur(weaponPart(arme(d.slug, skin)))).entries()) yield [`icone-arme|${d.slug}|${n}|${skin ? 'k' : ''}`, v];
  for (const d of SHIELD_DEFS)
    for (const [n, v] of vues(objetSansPorteur(shieldPart({ ...arme('bouclier'), shape: d.slug }))).entries()) yield [`icone-bouclier|${d.slug}|${n}`, v];
  for (const l of MATIERES) for (const slot of ['tete', 'torse', 'bras', 'jambes'] as const) {
    const p = armourPart(armure(l), slot);
    if (p) for (const [n, v] of vues(objetSansPorteur(p)).entries()) yield [`icone-armure|${l}|${slot}|${n}`, v];
  }
}

describe('références de dégradé d’un rendu final (#1903 A4)', () => {
  it('(0) aucun `@` ne sort ; (1) chaque `url(#id)` a sa définition ; (2) un id défini plusieurs fois a un seul contenu', () => {
    expect(fautesDeReferences(corpus())).toEqual([]);
  });

  it('(1\') chaque `url(#id)` littéral du source du rig vise un id global, local au fichier, ou un `dg-` de forme et d’arité connues', () => {
    const DG = /^dg-([a-z0-9]+)((?:-(?:@[a-zA-Z]\w*|#[0-9a-fA-F]{6}))+)$/;
    const fautes: string[] = [];
    for (const rel of listerArbre(RIG, { filtre: (r) => /\.tsx?$/.test(r) && !estFichierVitest(r) })) {
      const src = readFileSync(resolve(RIG, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const locaux = new Set([...src.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
      for (const [, id] of src.matchAll(/url\(#([^)'"`\s]*)\)/g)) {
        if (id.includes('${')) continue;
        if (GLOBAUX.has(id) || locaux.has(id)) continue;
        const dg = DG.exec(id);
        const forme = dg ? FORMES_DE_DEGRADE[dg[1]] : undefined;
        if (!dg || !forme || dg[2].slice(1).split('-').length !== forme.arrets.length) fautes.push(`${rel} url(#${id})`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('(3) aucune définition de dégradé dans l’art du rig hors `fxGradients.ts` et la résolution `dg-`', () => {
    const permis = new Set(['fxGradients.ts', 'palette.ts']);
    const fautes = listerArbre(RIG, { filtre: (rel) => /\.tsx?$/.test(rel) && !estFichierVitest(rel) && !permis.has(rel) })
      .filter((rel) => /<(linear|radial)Gradient\s[^>]*id=/.test(readFileSync(resolve(RIG, rel), 'utf8')));
    expect(fautes).toEqual([]);
  });
});
