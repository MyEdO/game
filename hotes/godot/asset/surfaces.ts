/**
 * LES SURFACES D'UN MODÈLE (#2972, #3086) : chaque surface nomme un matériau du GLB et l'emplacement de palette dont il
 * prend la couleur ; une surface `blason: true` reçoit au montage l'emblème choisi (#3111) et porte l'UV `TEXCOORD_0` ;
 * `parSexe` nomme, par sexe du porteur, le matériau du GLB qui remplace le sien (#3188), sa variante
 * `KHR_materials_variants` du nom du sexe sur chaque primitive de la surface. Un élément (`element.ts`) et une base
 * (`manifesteDeBase.ts`) les déclarent ; seul un élément admet le blason, seule une base `parSexe`.
 */
import { estObjet } from '../../../src/hote/formes.ts';
import { SLOTS, type Slot } from '../../../src/lib/palette.ts';
import { SEXES, type Sexe } from '../../../src/lib/sexe.ts';
import type { ContenuGlb } from './glb.ts';

export interface Surface {
  readonly nom: string;
  readonly palette: Slot;
  readonly blason?: true;
  readonly parSexe?: Readonly<Partial<Record<Sexe, string>>>;
}

/** Qui déclare des surfaces : un élément admet `blason`, une base `parSexe`. */
export type PorteurDeSurfaces = 'element' | 'base';

export type CodeDEcartDeSurface = 'forme' | 'palette-inconnue' | 'surface-absente' | 'uv-absente';

export interface EcartDeSurface {
  readonly code: CodeDEcartDeSurface;
  readonly ou: string;
  readonly detail: string;
}

const estSlot = (v: unknown): v is Slot => (SLOTS as readonly unknown[]).includes(v);

const OPTION: Record<PorteurDeSurfaces, 'blason' | 'parSexe'> = { element: 'blason', base: 'parSexe' };

/** `brut.parSexe` lu : une table d'un sexe (`SEXES`) au nom non vide d'un matériau ; `null` hors de cette forme. */
function lireParSexe(brut: unknown): Partial<Record<Sexe, string>> | null {
  if (!estObjet(brut) || !Object.keys(brut).length) return null;
  const entrees = Object.entries(brut);
  return entrees.every(([sexe, nom]) => (SEXES as readonly string[]).includes(sexe) && typeof nom === 'string' && nom !== '') ? Object.fromEntries(entrees) : null;
}

/** Les surfaces `brut` d'un modèle lues, et leurs écarts de forme ; `porteur` dit l'option qu'une surface admet. */
export function lireSurfaces(brut: unknown, porteur: PorteurDeSurfaces): { readonly surfaces: Surface[]; readonly ecarts: EcartDeSurface[] } {
  const ecarts: EcartDeSurface[] = [];
  const refus = (code: CodeDEcartDeSurface, ou: string, detail: string) => ecarts.push({ code, ou, detail });
  if (!Array.isArray(brut)) return { surfaces: [], ecarts: [{ code: 'forme', ou: 'surfaces', detail: 'liste attendue' }] };
  const option = OPTION[porteur];
  const attendue = `\`{ nom, palette }\` attendu, \`${option}\` en option`;
  const noms = new Set<string>();
  const surfaces = brut.flatMap((s: unknown, i): Surface[] => {
    const ou = `surfaces.${i}`;
    const autres = estObjet(s) ? Object.keys(s).filter((c) => c !== 'nom' && c !== 'palette' && c !== option) : [];
    if (!estObjet(s) || typeof s.nom !== 'string' || s.nom === '' || s.palette === undefined || autres.length) {
      refus('forme', ou, attendue);
      return [];
    }
    if (s.blason !== undefined && s.blason !== true) refus('forme', `${ou}.blason`, `${String(s.blason)} : \`true\` ou absent attendu`);
    const parSexe = s.parSexe === undefined ? undefined : lireParSexe(s.parSexe);
    if (parSexe === null) refus('forme', `${ou}.parSexe`, `table d’un sexe (${SEXES.map((e) => `\`${e}\``).join(', ')}) au nom d’un matériau attendue`);
    if (noms.has(s.nom)) refus('forme', `${ou}.nom`, `${s.nom} nommée deux fois`);
    noms.add(s.nom);
    if (!estSlot(s.palette)) {
      refus('palette-inconnue', `${ou}.palette`, `${String(s.palette)} : ${SLOTS.map((e) => `\`${e}\``).join(', ')} attendue`);
      return [];
    }
    return [{ nom: s.nom, palette: s.palette, ...(s.blason === true ? { blason: true } : {}), ...(parSexe ? { parSexe } : {}) }];
  });
  return { surfaces, ecarts };
}

/** Les écarts des surfaces `surfaces` au GLB lu `glb` : un matériau qu'il ne nomme pas, un blason sans UV, un matériau
 *  par sexe qui n'est pas, sur chaque primitive de la surface, sa variante du nom du sexe. */
export function ecartsAuGlb(surfaces: readonly Surface[], glb: Pick<ContenuGlb, 'materiaux' | 'materiauxSansUv' | 'variantes'>): EcartDeSurface[] {
  return surfaces.flatMap((s, i): EcartDeSurface[] => {
    if (!glb.materiaux.has(s.nom)) return [{ code: 'surface-absente', ou: `surfaces.${i}.nom`, detail: `${s.nom} n’est le nom d’aucun matériau du GLB` }];
    const sansVariante = Object.entries(s.parSexe ?? {}).filter(([sexe, nom]) => glb.variantes.get(s.nom)?.get(sexe) !== nom)
      .map(([sexe, nom]): EcartDeSurface => ({ code: 'surface-absente', ou: `surfaces.${i}.parSexe.${sexe}`, detail: `${nom} n’est pas, sur chaque primitive du matériau ${s.nom}, sa variante \`KHR_materials_variants\` « ${sexe} »` }));
    return [...(s.blason && glb.materiauxSansUv.has(s.nom) ? [{ code: 'uv-absente' as const, ou: `surfaces.${i}.blason`, detail: `une primitive du matériau ${s.nom} n’a pas d’attribut \`TEXCOORD_0\` où poser l’emblème` }] : []), ...sansVariante];
  });
}
