import { BONE_IDS, type BoneId, type Bone, type Skeleton } from './bones';
import { worldTransforms, apply } from './kinematics';
import { gabaritById, type GabaritDef } from './gabarits';
import speciesRaceJson from '../../data/speciesRace.json';
import type { Sexe } from '../../data/schemas/grammaire/valeurs';

function mk(spec: Record<BoneId, Omit<Bone, 'id'>>): Skeleton {
  const sk = {} as Skeleton;
  for (const id of BONE_IDS) sk[id] = { id, ...spec[id] };
  return sk;
}

/** Squelette HUMAIN mâle de référence (boîte 120×150, pieds ~y=150).
 *
 *  CANON D'EMBOÎTEMENT (#633 P3 — `rig/SKELETON-CONTRACT.md`) : les pivots/longueurs sont DÉRIVÉS
 *  des repères anatomiques de l'ART (l'art des 117 tenues est la donnée fixe, le squelette s'y
 *  emboîte — jamais l'inverse). Repères-monde ancrés au sol (bassin descendu à y=86 par
 *  `groundSkeleton`) : col du torse ~44, menton 40 (2..6 AU-DESSUS du col : le cou existe),
 *  hanches 90 = ceinture de l'art de torse (+15..20 local), ourlet +34 → ~108 (mi-cuisse,
 *  genou 116 VISIBLE), chevilles 140, sol 150. Gardé par `skeleton-canon.test.ts`. */
const HUMAIN_M: Skeleton = mk({
  bassin:     { parent: null,         pivot: { x: 60, y: 96 },  length: 0,  thickness: 18, angle: 0,  z: 5 },
  // Origine du torse = TAILLE DE L'ART (l'art de torse peint sa ceinture à +15..20, son ourlet à
  // +34) : −12 au-dessus du bassin place ces repères sur les hanches/la mi-cuisse. À −2 (POC),
  // l'ourlet tombait à ~118 (sous le GENOU 116) → jambes « enfoncées », cuisses invisibles.
  torse:      { parent: 'bassin',     pivot: { x: 0,  y: -12 }, length: 34, thickness: 20, angle: 0,  z: 5 },
  // z SOUS le torse (5) — #633 P2 : un col de tenue (dessiné au torse) couvre le cou NATURELLEMENT
  // par tri du peintre, sans patch par tenue ni retouche de `composeRig`.
  cou:        { parent: 'torse',      pivot: { x: 0,  y: -34 }, length: 16, thickness: 6,  angle: 0,  z: 4.5 },
  // tete.pivot.y = −cou.length (emboîtement) : l'os tête naît au SOMMET du cou. L'art de visage
  // descend à +16 (menton) → menton à torse-local −50+16 = −34, 2..6 au-dessus du col de
  // l'art (−28..−32). À −6/−6 (POC), le menton tombait 8 SOUS le col → tête « enfoncée », sans cou.
  tete:       { parent: 'cou',        pivot: { x: 0,  y: -16 }, length: 14, thickness: 14, angle: 0,  z: 7 },
  epauleG:    { parent: 'torse',      pivot: { x: -14, y: -26 }, length: 18, thickness: 7, angle: 8,  z: 4 },
  avantBrasG: { parent: 'epauleG',    pivot: { x: 0,  y: 18 },  length: 18, thickness: 6,  angle: 5,  z: 4 },
  // Poignet à 18 = bout de l'avant-bras (emboîtement canonique restauré, #633 D1) : l'art d'avant-bras
  // (coude→poignet, 0..16) finit au poignet ; la vraie main (`HAND`, resolve.ts) s'y emboîte sans moignon.
  mainG:      { parent: 'avantBrasG', pivot: { x: 0,  y: 18 },  length: 6,  thickness: 6,  angle: 0,  z: 4 },
  epauleD:    { parent: 'torse',      pivot: { x: 14, y: -26 }, length: 18, thickness: 7,  angle: -8, z: 8 },
  avantBrasD: { parent: 'epauleD',    pivot: { x: 0,  y: 18 },  length: 18, thickness: 6,  angle: -5, z: 8 },
  mainD:      { parent: 'avantBrasD', pivot: { x: 0,  y: 18 },  length: 6,  thickness: 6,  angle: 0,  z: 8 },
  cuisseG:    { parent: 'bassin',     pivot: { x: -9, y: 4 },   length: 26, thickness: 9,  angle: 4,  z: 3 },
  tibiaG:     { parent: 'cuisseG',    pivot: { x: 0,  y: 26 },  length: 24, thickness: 7,  angle: 2,  z: 3 },
  piedG:      { parent: 'tibiaG',     pivot: { x: 0,  y: 24 },  length: 10, thickness: 6,  angle: 0,  z: 3 },
  cuisseD:    { parent: 'bassin',     pivot: { x: 9,  y: 4 },   length: 26, thickness: 9,  angle: -4, z: 6 },
  tibiaD:     { parent: 'cuisseD',    pivot: { x: 0,  y: 26 },  length: 24, thickness: 7,  angle: -2, z: 6 },
  piedD:      { parent: 'tibiaD',     pivot: { x: 0,  y: 24 },  length: 10, thickness: 6,  angle: 0,  z: 6 },
  arme:       { parent: 'mainD',      pivot: { x: 0,  y: 4 },   length: 0,  thickness: 0,  angle: 165, z: 9 },
  bouclier:   { parent: 'mainG',      pivot: { x: 0,  y: 4 },   length: 0,  thickness: 0,  angle: 0,  z: 4 },
});

/** Échelle (longueur sl, épaisseur st) appliquée à tout le squelette. Renvoie un nouvel objet. */
function scaleSkeleton(sk: Skeleton, sl: number, st: number): Skeleton {
  const out = {} as Skeleton;
  for (const id of BONE_IDS) {
    const b = sk[id];
    // La RACINE (bassin, parent null) est l'ANCRE ABSOLUE de la figure : son pivot.x = 60 est
    // l'axe de symétrie = centre de la boîte 120 large (le token ancre rig-x=60 sur la case).
    // Mettre ce x à l'échelle décentrerait toute la figure (Minotaure/Ogre st=1.7 → bassin à
    // x=102 → la silhouette débordait à droite de sa case). On garde donc le pivot.x de la
    // racine ; seuls les pivots des os ENFANTS (offsets RELATIFS : épaules ±14, hanches ±9)
    // s'échelonnent en x pour élargir la carrure.
    const isRoot = b.parent == null;
    out[id] = {
      ...b,
      pivot: { x: isRoot ? b.pivot.x : b.pivot.x * st, y: b.pivot.y * sl },
      length: b.length * sl,
      thickness: b.thickness * st,
    };
  }
  return out;
}

type SpeciesRule = { prefix?: string[]; includes?: string[]; all?: string[]; any?: string[]; race: string };
const SPECIES_RACE = speciesRaceJson as { default: string; rules: SpeciesRule[] };

/** Espèce (slug/libellé) → RACE-ID du rig (carrure/palette/features/posture). Règles ORDONNÉES
 *  pilotées par `data/speciesRace.json` (ajouter un mapping = une ligne JSON, jamais une if-chain) ;
 *  première qui matche gagne, sinon `default`. `s` déjà en minuscules (préfixes ASCII → `homme`
 *  matche `homme-bete`). Garde-fou : `creatures.unique.test.ts` vérifie que chaque slug mappe vers
 *  une race EXISTANTE. */
export function baseSpeciesOf(species: string): string {
  const s = species.toLowerCase();
  for (const r of SPECIES_RACE.rules) {
    if (r.prefix && r.prefix.some((t) => s.startsWith(t))) return r.race;
    if (r.includes && r.includes.some((t) => s.includes(t))) return r.race;
    if (r.all && r.all.every((t) => s.includes(t)) && (r.any ?? []).some((t) => s.includes(t))) return r.race;
  }
  return SPECIES_RACE.default;
}


export function baseSkeleton(p: GabaritDef, sex: Sexe): Skeleton {
  let sk = scaleSkeleton(HUMAIN_M, p.sl, p.st);
  // Jambes spécifiques (Nain/Halfling courtes, Elfe longues). On raccourcit la
  // LONGUEUR des os de jambe ET le pivot des joints enfants (tibia sur cuisse,
  // pied sur tibia) : dans le gabarit de réf, tibia.pivot.y == cuisse.length, etc.
  // Sans ça, le chaînage FK reste à la longueur d'origine → membres déconnectés
  // (la part dessinée est plus courte que l'écart des joints) ET pieds qui flottent
  // (la FK place le pied plus bas que la jambe réellement dessinée).
  if (p.legs !== 1) {
    for (const id of ['cuisseG', 'tibiaG', 'cuisseD', 'tibiaD'] as BoneId[])
      sk[id] = { ...sk[id], length: sk[id].length * p.legs };
    for (const id of ['tibiaG', 'tibiaD', 'piedG', 'piedD'] as BoneId[])
      sk[id] = { ...sk[id], pivot: { x: sk[id].pivot.x, y: sk[id].pivot.y * p.legs } };
  }
  // Bras allongés (ex. Troll, bras jusqu'au sol) — même logique que les jambes : longueur des
  // os + pivot des joints enfants (avant-bras sur épaule, main sur avant-bras).
  const arms = p.arms ?? 1;
  if (arms !== 1) {
    for (const id of ['epauleG', 'avantBrasG', 'epauleD', 'avantBrasD'] as BoneId[])
      sk[id] = { ...sk[id], length: sk[id].length * arms };
    for (const id of ['avantBrasG', 'avantBrasD', 'mainG', 'mainD'] as BoneId[])
      sk[id] = { ...sk[id], pivot: { x: sk[id].pivot.x, y: sk[id].pivot.y * arms } };
  }
  // Tête surdimensionnée (gremlins) : la PART tête se rend à l'échelle (thickness/réf,
  // length/réf) de l'os `tete` → on agrandit cet os pour une grosse tête sur petit corps.
  const head = p.head ?? 1;
  if (head !== 1) sk.tete = { ...sk.tete, length: sk.tete.length * head, thickness: sk.tete.thickness * head };
  if (sex === 'F') sk = feminize(sk);
  return sk;
}

/** Proportions féminines : épaules plus étroites, hanches un peu plus larges. */
function feminize(sk: Skeleton): Skeleton {
  const out = { ...sk };
  out.epauleG = { ...sk.epauleG, pivot: { x: sk.epauleG.pivot.x * 0.85, y: sk.epauleG.pivot.y } };
  out.epauleD = { ...sk.epauleD, pivot: { x: sk.epauleD.pivot.x * 0.85, y: sk.epauleD.pivot.y } };
  out.torse = { ...sk.torse, thickness: sk.torse.thickness * 0.92 };
  out.cuisseG = { ...sk.cuisseG, pivot: { x: sk.cuisseG.pivot.x * 1.08, y: sk.cuisseG.pivot.y } };
  out.cuisseD = { ...sk.cuisseD, pivot: { x: sk.cuisseD.pivot.x * 1.08, y: sk.cuisseD.pivot.y } };
  return out;
}

/**
 * Squelette de RÉFÉRENCE (humain M, build 0.5) — gabarit dont les parts SVG sont
 * dessinées. Le rendu échelonne chaque part par (thickness/réf, length/réf).
 */
let _ref: Skeleton | null = null;
export function referenceSkeleton(): Skeleton {
  if (!_ref) _ref = applyBuild(baseSkeleton(gabaritById('moyen'), 'M'), 0.5);
  return _ref;
}

/**
 * Ancre les PIEDS au sol (y=floorY) quelle que soit la taille de l'espèce. Le scaling
 * d'espèce déplace la racine (bassin) → sans ça, les petits (Nain/Gnome) flottent et
 * les grands (Ogre) débordent sous la boîte. On calcule la position réelle du pied en
 * FK (pose de repos) et on translate tout le squelette via le pivot du bassin.
 */
export function groundSkeleton(sk: Skeleton, floorY = 150): Skeleton {
  const world = worldTransforms(sk, {});
  const footY = Math.max(
    apply(world.piedG, { x: 0, y: sk.piedG.length }).y,
    apply(world.piedD, { x: 0, y: sk.piedD.length }).y,
  );
  const delta = floorY - footY;
  if (Math.abs(delta) < 0.01) return sk;
  return { ...sk, bassin: { ...sk.bassin, pivot: { x: sk.bassin.pivot.x, y: sk.bassin.pivot.y + delta } } };
}

/** Profil : rapproche épaules/hanches de l'AXE. Le pantin est de face (épaules à ±14) ;
 *  de profil le corps est étroit et les membres alignés sur la ligne médiane — sinon les
 *  bras « flottent » loin du torse étroit. Ne touche pas les y (pieds restent au sol).
 *
 *  De profil un humain ne montre qu'UN bras (le proche) ; l'autre est occulté par le torse.
 *  Ici on se contente de resserrer épaules/hanches vers la médiane du corps étroit ; l'occultation
 *  du bras LOIN (chaîne epauleG) est un geste de RENDU, fait dans `composeRig` pour la vue profil
 *  (il pend sous l'ourlet et redessinait une 2ᵉ silhouette — « doubles bras », #633). */
export function profileNarrow(sk: Skeleton): Skeleton {
  const out = { ...sk };
  const narrow = (id: BoneId, f: number) => {
    out[id] = { ...sk[id], pivot: { x: sk[id].pivot.x * f, y: sk[id].pivot.y } };
  };
  narrow('epauleG', 0.32);
  narrow('epauleD', 0.32);
  narrow('cuisseG', 0.38);
  narrow('cuisseD', 0.38);
  return out;
}

/** Os de CEINTURE dont l'écartement latéral (pivot.x) doit suivre la carrure du tronc — sinon
 *  leur offset reste figé quel que soit `build` : un mince rentre le torse (thickness) mais garde
 *  des hanches écartées comme un costaud → débord pelvien latéral (audit rig 2026-07-21). */
const WAIST_BONES: BoneId[] = ['cuisseG', 'cuisseD', 'epauleG', 'epauleD'];

/** Morphologie continue : build 0..1 → épaississement (torse/membres) + écartement de ceinture
 *  (hanches/épaules) au MÊME facteur `k`. Pur, sans mutation. */
export function applyBuild(sk: Skeleton, build: number): Skeleton {
  const b = Math.max(0, Math.min(1, build));
  const k = 0.7 + b * 0.7; // 0.7..1.4
  const out = {} as Skeleton;
  for (const id of BONE_IDS) {
    const bone = sk[id];
    const pivot = WAIST_BONES.includes(id) ? { x: bone.pivot.x * k, y: bone.pivot.y } : bone.pivot;
    out[id] = { ...bone, pivot, thickness: bone.thickness * k, length: bone.length * (1 + (b - 0.5) * 0.05) };
  }
  return out;
}
