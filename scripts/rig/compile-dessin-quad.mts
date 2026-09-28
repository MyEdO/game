/**
 * COMPILATEUR DE DESSIN QUADRUPÈDE — « bête entière par vue » (#1082).
 *
 *   npx tsx scripts/rig/compile-dessin-quad.mts [--check] [espèce…]
 *
 * ENTRÉE  : `src/gameIso/rig/quadruped/atelier/<espèce>-<vue>.dessin.mts`, `<vue>` parmi `VIEWS`
 *           (`facing.ts`) — une illustration en coordonnées MONDE (canevas 120×150, sol y=150),
 *           groupée par os, langage restreint.
 * SORTIE  : `src/gameIso/rig/quadruped/<espèce>Compile.ts` — UNE table keyée par vue des vues
 *           dessinées de l'espèce, l'art par OS dans le repère LOCAL de chaque os, typée comme
 *           `QuadProps.viewArt` qu'elle alimente. Le moteur de RENDU reçoit de l'art de part comme
 *           tout autre.
 *
 * SETS D'ÉQUIPEMENT (#1128) : `atelier/harnais/<set>@<espèce>-<vue>.dessin.mts` → `quadruped/harnais/
 * <set>Compile.ts`, une table keyée par vue de même forme. Le suffixe `@<espèce>` donne le GABARIT
 * (squelette, pose, échelles d'os) sur lequel l'art est cuit — même cuisson, même langage restreint,
 * même idempotence qu'un dessin d'espèce. L'art d'un set est donc FIT-PAR-GABARIT : le registre
 * `quadruped/harnais/` déclare pour quelles espèces il est cuit (`especes`), et sa sortie alimente le
 * canal `deco` (calque par-os) par `quadDecoFromViewArt` (`quadSkeleton.ts`), pas `viewArt`.
 *
 * Les dessins se groupent par SORTIE, keyée par l'id (le set, sinon l'espèce) : deux dessins d'une
 * même sortie pour une même vue lèvent en se nommant. Un filtre positionnel choisit des sorties :
 * une sortie se compile, de tous ses dessins, dès que l'un d'eux est visé.
 *
 * MÉCANIQUE — le rendu compose : monde = M(os) · S(os) · local  (`composeQuad` : `transform=
 * toSvg(matrix)` puis `scale(sx,sy)`). Le compilateur applique donc l'INVERSE, T = S⁻¹ · M⁻¹, à
 * CHAQUE coordonnée du dessin, et CUIT le résultat dans le `d` du path. Aucun `<g transform>` n'est
 * émis : l'art compilé vit dans le repère de son os, comme tout art de part du dépôt (le cliquet
 * `REPERES_ART_PROPRES_GELES` interdit qu'une part s'enveloppe dans son propre repère).
 * Les matrices M viennent du SQUELETTE RÉEL en pose de REPOS (`buildQuadSkeleton` →
 * `quadSkeletonForView` → `groundQuad` → `worldTransformsG`), l'échelle S de `quadBoneScale` —
 * jamais d'un littéral recopié. La POSE de référence se compose par la MÊME expression que le rendu
 * (`resolveQuadFromProps` : `QUAD_REST` ADDITIONNÉ au `stance` de l'espèce, en PROFIL seulement —
 * les vues de bout refigent leurs angles) : la bête que l'artiste a sous les yeux.
 *
 * Une largeur de trait est mise à l'échelle par √|det T| : le trait garde au monde l'épaisseur que
 * l'artiste a vue. Sous une échelle NON UNIFORME (carrure 1,2 en y du tronc bovin) c'est une
 * approximation — un trait de 0,7 u y devient 0,64 u au lieu de varier avec son orientation.
 *
 * IDEMPOTENT : relancé sur les mêmes dessins, il réécrit le même octet. `--check` n'écrit rien et
 * sort en 1 si une sortie diverge de ses dessins (porte de commit).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, basename, relative } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** Racine du dossier `quadruped/` — l'atelier lu (`<racine>/atelier`) et les sorties écrites
 *  (`<racine>/`, `<racine>/harnais/`). Surchargeable par `QUAD_RIG_RACINE` : un harnais de test
 *  compile alors dans un bac à sable, hors de l'arbre `src/` que les gardes scannent. Le gabarit,
 *  le squelette et la pose viennent toujours de `ROOT` (le moteur réel). */
const RACINE = process.env.QUAD_RIG_RACINE
  ? resolve(process.env.QUAD_RIG_RACINE)
  : resolve(ROOT, 'src/gameIso/rig/quadruped');
const ATELIER = resolve(RACINE, 'atelier');
const ATELIER_SETS = resolve(ATELIER, 'harnais');
const DEST_DIR = RACINE;
const DEST_SETS = resolve(DEST_DIR, 'harnais');
const CHECK = process.argv.includes('--check');
const FILTRE = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const { QUAD_SPECIES, WINGED_SPECIES } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/creatures/index.ts'))}`);
const { buildQuadSkeleton, quadSkeletonForView, groundQuad } =
  await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/quadruped/quadSkeleton.ts'))}`);
const { worldTransformsG } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/kinematics.ts'))}`);
const { QUAD_REST } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/quadruped/quadPose.ts'))}`);
const { quadBoneScale } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/quadruped/composeQuad.ts'))}`);
const { VIEWS } = await import(`${pathToFileURL(resolve(ROOT, 'src/gameIso/rig/facing.ts'))}`) as { VIEWS: readonly string[] };

type Mat = [number, number, number, number, number, number]; // a b c d e f : x'=ax+cy+e, y'=bx+dy+f
interface GroupeDessin { bone: string; svg: string }

/** `grand-cerf` → `GRAND_CERF_COMPILE` (nom de la constante exportée). */
const constante = (id: string) => `${id.replace(/-/g, '_').toUpperCase()}_COMPILE`;
/** `grand-cerf` → `grandCerf` ; le module de la sortie est `grandCerfCompile.ts`. */
const camel = (s: string) => s.replace(/-(.)/g, (_m, c: string) => c.toUpperCase());

/**
 * Nom de dessin → gabarit d'espèce, vue, et id de SET quand le dessin en est un.
 *   `boeuf-profile`                    → { set: null, espece: 'boeuf', vue: 'profile' }
 *   `sellerie-imperiale@cheval-profile` → { set: 'sellerie-imperiale', espece: 'cheval', vue: 'profile' }
 * Le `@` n'est admis QUE sous `atelier/harnais/`, et y est OBLIGATOIRE : le gabarit d'un set se lit
 * dans son nom, jamais deviné.
 */
function lireNom(nom: string, set: boolean): { set: string | null; espece: string; vue: string } {
  const at = nom.indexOf('@');
  if (set && at < 0) throw new Error(`${nom} : dessin de set sans gabarit — attendu <set>@<espèce>-<vue>.dessin.mts`);
  if (!set && at >= 0) throw new Error(`${nom} : suffixe @<espèce> réservé aux dessins de set (atelier/harnais/)`);
  const reste = nom.slice(at + 1);
  const coupe = reste.lastIndexOf('-');
  if (coupe <= 0) throw new Error(`${nom} : nom illisible — attendu <espèce>-<vue>`);
  return { set: at < 0 ? null : nom.slice(0, at), espece: reste.slice(0, coupe), vue: reste.slice(coupe + 1) };
}

/** T = S⁻¹ · M⁻¹ — le passage monde → repère local de l'os, échelle d'os comprise. */
function versLocal(p: unknown, sk: Record<string, unknown>, world: Record<string, Mat>, bone: string, vue: string): Mat {
  const m = world[bone];
  const [sx, sy] = quadBoneScale(p, sk[bone], vue);
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-9) throw new Error(`matrice singulière pour ${bone}`);
  const inv: Mat = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  return [inv[0] / sx, inv[1] / sy, inv[2] / sx, inv[3] / sy, inv[4] / sx, inv[5] / sy];
}
const applique = (t: Mat, x: number, y: number): [number, number] =>
  [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];

/** Cuisson des coordonnées d'un fragment. Langage restreint : M/L/C/Q/Z en ABSOLU uniquement. */
function cuire(svg: string, t: Mat): string {
  const k = Math.sqrt(Math.abs(t[0] * t[3] - t[1] * t[2]));
  return svg
    .replace(/d="([^"]+)"/g, (_m, d: string) => {
      const jetons = d.match(/[MLCQZ]|-?\d+(?:\.\d+)?/g) ?? [];
      const out: string[] = [];
      const nb: number[] = [];
      const vide = () => {
        for (let i = 0; i + 1 < nb.length; i += 2) {
          const [X, Y] = applique(t, nb[i], nb[i + 1]);
          out.push(`${+X.toFixed(2)} ${+Y.toFixed(2)}`);
        }
        nb.length = 0;
      };
      for (const j of jetons) {
        if (/[MLCQZ]/.test(j)) { vide(); out.push(j); } else nb.push(+j);
      }
      vide();
      return `d="${out.join(' ').replace(/([MLCQZ]) /g, '$1')}"`;
    })
    .replace(/stroke-width="([\d.]+)"/g, (_m, w: string) => `stroke-width="${+(+w * k).toFixed(2)}"`);
}

/** Un dessin compilé : sa sortie (`id`, `set`), sa vue et ses lignes `<os>: <art>` cuites. */
interface Compilation { rel: string; id: string; set: string | null; vue: string; lignes: string[] }

/** Compile UN dessin. */
async function compile(fichier: string): Promise<Compilation> {
  const rel = relative(ATELIER, fichier).replace(/\\/g, '/');
  const nom = basename(fichier, '.dessin.mts');
  const { set, espece, vue } = lireNom(nom, rel.startsWith('harnais/'));
  if (!VIEWS.includes(vue)) throw new Error(`${nom} : vue inconnue « ${vue} » (attendu : ${VIEWS.join(', ')})`);
  const especes = { ...QUAD_SPECIES, ...WINGED_SPECIES } as Record<string, Record<string, unknown>>;
  const p = especes[espece];
  if (!p) throw new Error(`${nom} : espèce inconnue du registre « ${espece} »`);

  let pose: Record<string, number> = QUAD_REST as Record<string, number>;
  if (p.stance && vue === 'profile') {
    const merged: Record<string, number> = { ...(p.stance as Record<string, number>) };
    for (const [id, d] of Object.entries(pose)) merged[id] = (merged[id] ?? 0) + (d ?? 0);
    pose = merged;
  }
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), vue), pose);
  const world = worldTransformsG(sk, pose) as Record<string, Mat>;
  const { DESSIN } = await import(`${pathToFileURL(fichier)}`) as { DESSIN: GroupeDessin[] };

  const lignes: string[] = [];
  for (const g of DESSIN) {
    if (!world[g.bone]) throw new Error(`${nom} : os inconnu du squelette — ${g.bone}`);
    const art = cuire(g.svg, versLocal(p, sk, world, g.bone, vue));
    if (/<g[^>]*transform/.test(art)) throw new Error(`${nom} : repère propre interdit sur ${g.bone}`);
    lignes.push(`    ${g.bone}: ${JSON.stringify(art)},`);
  }
  return { rel, id: set ?? espece, set, vue, lignes };
}

/** Le module d'une sortie, de ses dessins dans l'ordre de `VIEWS` : une entrée par vue dessinée. */
function moduleDe(parVue: readonly Compilation[]): { dest: string; texte: string } {
  const { id, set } = parVue[0];
  const [facing, squelette] = set ? ['../../facing', '../quadSkeleton'] : ['../facing', './quadSkeleton'];
  const texte =
    `// GÉNÉRÉ par scripts/rig/compile-dessin-quad.mts depuis ${parVue.map((d) => `atelier/${d.rel}`).join(', ')} — ne pas éditer à la main.\n` +
    `import type { View } from '${facing}';\n` +
    `import type { QuadBoneId } from '${squelette}';\n` +
    `export const ${constante(id)}: Partial<Record<View, Partial<Record<QuadBoneId, string>>>> = {\n` +
    parVue.map((d) => `  ${d.vue}: {\n${d.lignes.join('\n')}\n  },\n`).join('') +
    `};\n`;
  return { dest: resolve(set ? DEST_SETS : DEST_DIR, `${camel(id)}Compile.ts`), texte };
}

// ── balayage de l'atelier (dessins d'espèce à plat + dessins de set sous harnais/) ────────────
const dessinsDe = (dir: string): string[] => {
  try { return readdirSync(dir).filter((f) => f.endsWith('.dessin.mts')).map((f) => resolve(dir, f)); }
  catch { return []; }
};
/** Un filtre positionnel vise un id de SET ou une espèce (`… cheval` prend aussi les sets du cheval). */
const vise = (d: Compilation): boolean => {
  if (!FILTRE.length) return true;
  const { set, espece } = lireNom(basename(d.rel, '.dessin.mts'), d.set !== null);
  return FILTRE.includes(espece) || (set !== null && FILTRE.includes(set));
};
const compilations = await Promise.all([...dessinsDe(ATELIER), ...dessinsDe(ATELIER_SETS)].sort().map(compile));
const sorties = new Map<string, Compilation[]>();
for (const d of compilations) {
  const cle = `${d.set === null ? '' : 'harnais/'}${d.id}`;
  const sortie = sorties.get(cle) ?? [];
  const doublon = sortie.find((autre) => autre.vue === d.vue);
  if (doublon) {
    console.error(`deux dessins de la sortie « ${d.id} » pour la vue ${d.vue} : atelier/${doublon.rel}, atelier/${d.rel}`);
    process.exit(1);
  }
  sorties.set(cle, [...sortie, d]);
}
const visees = [...sorties.values()].filter((dessins) => dessins.some(vise))
  .map((dessins) => VIEWS.flatMap((vue) => dessins.filter((d) => d.vue === vue)));
if (!visees.length) { console.error(`aucun dessin dans ${ATELIER}`); process.exit(1); }

const divergents: string[] = [];
for (const dessins of visees) {
  const rels = dessins.map((d) => d.rel).join(', ');
  const groupes = dessins.reduce((n, d) => n + d.lignes.length, 0);
  const { dest, texte } = moduleDe(dessins);
  const actuel = (() => { try { return readFileSync(dest, 'utf8'); } catch { return null; } })();
  if (CHECK) {
    if (actuel !== texte) divergents.push(`${rels} → ${basename(dest)}`);
    console.log(`${actuel === texte ? 'à jour ' : 'DIVERGE'} : ${rels} (${groupes} groupes)`);
  } else {
    if (actuel !== texte) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, texte); }
    console.log(`compilé : ${rels} → ${basename(dest)} (${groupes} groupes${actuel === texte ? ', déjà à jour' : ''})`);
  }
}
if (divergents.length) {
  console.error(`sortie(s) divergentes du dessin — relancer sans --check :\n  ${divergents.join('\n  ')}`);
  process.exit(1);
}
