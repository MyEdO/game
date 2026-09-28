/**
 * AUDIT des dettes d'ART quadrupède (#1082) — définition UNIQUE des trois mesures, partagée par les
 * gardes `src/gameIso/rig/quadruped/quad-anchor-contract.test.ts` et `quad-vues-ratchet.test.ts` et
 * par la régénération de `quadDecoStock.mjs` (`regenerations`). Deux lectures divergentes du corpus
 * laisseraient l'une écrire ce que l'autre refuse.
 *
 * Trois classes de défaut, toutes keyées `<espèce> <vue> <os|clé#vue>` :
 *  · REPÈRE PROPRE : l'art d'une part s'enveloppe d'un transform que `quadAnchor` ne reproduit pas —
 *    le décor authoré sur les coordonnées de l'art atterrit ailleurs.
 *  · DÉCOR MORT : une clé `deco` vise un os que la vue n'émet pas — le décor est peint nulle part.
 *  · DÉCOR SANS PLAN : un fragment de décor ne déclare pas son `plan` relatif à l'os.
 *
 * Le FICHIER du site est la def de créature, résolue PAR IDENTITÉ dans l'index généré
 * (`fichierDeDef`, `registreDeDefs.ts`) : c'est lui que la porte de plage (`croissanceDesStocks`)
 * voit, et celui que l'artiste ouvre pour solder.
 */
import { CREATURES } from '../../../src/gameIso/rig/creatures/_registry.generated';
import { quadParts, quadAnchor } from '../../../src/gameIso/rig/quadruped/quadParts';
import { OS_TETE } from '../../../src/gameIso/rig/quadruped/composeQuad';
import { quadDecoCouples, quadLayersSvg, type DecoCouples } from '../../../src/gameIso/rig/quadruped/deco-stock.fixture';
import { readQuadDecoKey, type QuadBoneId, type QuadProps } from '../../../src/gameIso/rig/quadruped/quadSkeleton';
import { VIEWS, type View } from '../../../src/gameIso/rig/facing';
import { REGISTRE_CREATURES, fichierDeDef } from './registreDeDefs';
import type { Site } from './stock.mjs';
import { fileURLToPath } from 'node:url';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

/** Les defs du registre qui portent un `quad` — la population des trois mesures. */
const quadDefs = CREATURES.filter((c) => c.quad);

/** Le fichier de def qui porte cette espèce — jamais un chemin fabriqué : l'index généré fait foi. */
export function fichierDeEspece(id: string): string {
  const def = CREATURES.find((c) => c.id === id);
  if (!def) throw new Error(`espèce « ${id} » absente du registre des créatures — la mesure ne sait plus quel fichier la porte`);
  return fichierDeDef(REGISTRE_CREATURES, def);
}

/** Un couple `<espèce> <vue> <clé>` en SITE : son fichier est la def de l'espèce. */
const siteDuCouple = (couple: string): Site => ({ file: fichierDeEspece(couple.split(' ')[0]), ref: couple });

/** Transform du `<g>` UNIQUE qui enveloppe tout l'art (balancé, couvrant la chaîne entière), sinon ''. */
export function wrappingTransform(art: string): string {
  const open = /^<g([^>]*)>/.exec(art);
  if (!open) return '';
  let depth = 0, end = -1;
  const tag = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(art))) {
    if (m[1]) depth--;
    else if (!m[4]) depth++;
    if (depth === 0) { end = tag.lastIndex; break; }
  }
  if (end !== art.length) return '';
  return (/transform="([^"]*)"/.exec(open[1]) ?? ['', ''])[1];
}

export interface MesureDesReperes {
  /** Les parts (espèce × vue × os) dont l'art porte un repère que l'ancre ne dit pas. */
  sites: Site[];
  /** Le détail lisible par clé de décor — ce que la garde imprime en rouge. */
  divergences: string[];
  /** Cardinaux de la population balayée : la garde y pose ses planchers anti-vacuité. */
  couplesTete: number;
  couplesDeco: number;
}

/** (a) l'art de TÊTE de toutes les defs ; (b) tout os visé par une clé `deco`. Le défaut vient de
 *  l'ART de la part, donc il se compte par PART (espèce × vue × os), jamais par clé de décor. */
export function mesureDesReperes(): MesureDesReperes {
  const divergences: string[] = [];
  const parts = new Set<string>();
  let couplesTete = 0, couplesDeco = 0;
  const verifier = (id: string, quad: QuadProps, view: View, bone: QuadBoneId, art: string, cle: string): void => {
    const ancre = quadAnchor(quad, bone, view);
    const enveloppe = wrappingTransform(art);
    if (ancre === enveloppe) return;
    parts.add(`${id} ${view} ${bone}`);
    divergences.push(`${id} ${view} ${cle} : ancre="${ancre || '(identité)'}" art="${enveloppe || '(aucun)'}"`);
  };
  for (const { id, quad: q } of quadDefs) {
    const quad = q as QuadProps;
    for (const view of VIEWS) {
      const nu = quadParts({ ...quad, deco: undefined }, view);
      for (const bone of OS_TETE) {
        const art = quadLayersSvg(nu[bone]);
        if (!art) continue;
        couplesTete++;
        verifier(id, quad, view, bone, art, bone);
      }
      for (const key of Object.keys(quad.deco ?? {})) {
        const { bone, views } = readQuadDecoKey(key);
        if (!views.includes(view)) continue;
        const art = quadLayersSvg(nu[bone]);
        if (!art) continue;
        couplesDeco++;
        verifier(id, quad, view, bone, art, key);
      }
    }
  }
  return { sites: [...parts].sort().map(siteDuCouple), divergences, couplesTete, couplesDeco };
}

export const MOTIF_REPERE_ART_PROPRE =
  "Un art qui s'enveloppe de son propre repère se RÉÉCRIT dans le repère de l'os (cf. le patron `boeuf profile tete`, lot B2), il ne s'entérine pas ici.";
export const MOTIF_DECO_MORT =
  "Un décor authoré pour une vue où son os n'est pas émis se CÂBLE (art de bout à créer, ou réaffectation à un os émis), il ne s'entérine pas ici.";
export const MOTIF_DECO_SANS_PLAN =
  "Un décor neuf DÉCLARE son `plan` relatif à l'os (`plan: 0` pour le plan de l'os), il ne s'entérine pas ici.";

/** La RÉGÉNÉRATION de `quadDecoStock.mjs`, ses trois collections sur les couples de décor et la mesure
 *  des repères (par défaut, celles du dépôt). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/quadDecoAudit.ts [--check]`. */
export const regenerations = (
  couples: DecoCouples = quadDecoCouples(),
  reperes: MesureDesReperes = mesureDesReperes(),
): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL('./quadDecoStock.mjs', import.meta.url)),
  politique: DECROISSANT,
  collections: [
    { nom: 'REPERES_ART_PROPRES_RATCHET', sites: reperes.sites, motif: MOTIF_REPERE_ART_PROPRE },
    { nom: 'DECOS_MORTS_RATCHET', sites: couples.morts.map(siteDuCouple), motif: MOTIF_DECO_MORT },
    { nom: 'DECOS_SANS_PLAN_RATCHET', sites: couples.sansPlan.map(siteDuCouple), motif: MOTIF_DECO_SANS_PLAN },
  ],
}];
