/**
 * LES SURFACES D'UN MODÈLE (#2972, #3086) : chaque surface nomme un matériau du GLB et l'emplacement de palette dont il
 * prend la couleur ; une surface `blason: true` reçoit au montage l'emblème choisi (#3111) et porte l'UV `TEXCOORD_0` ;
 * une surface `matiere` s'habille de la texture de cette matière de décor du monde, `prop--<id>` (#2987).
 * Un élément (`element.ts`) et une base (`manifesteDeBase.ts`) les déclarent ; seul un élément admet blason et matière.
 */
import { estObjet } from '../../../src/lib/objet.mjs';
import { SLOTS, type Slot } from '../../../src/lib/palette.ts';
import type { ContenuGlb } from './glb.ts';

export interface Surface {
  readonly nom: string;
  readonly palette: Slot;
  readonly blason?: true;
  readonly matiere?: string;
}

export type CodeDEcartDeSurface = 'forme' | 'matiere-inconnue' | 'palette-inconnue' | 'surface-absente' | 'uv-absente';

export interface EcartDeSurface {
  readonly code: CodeDEcartDeSurface;
  readonly ou: string;
  readonly detail: string;
}

const estSlot = (v: unknown): v is Slot => (SLOTS as readonly unknown[]).includes(v);

/** Les surfaces `brut` d'un modèle lues, et leurs écarts de forme ; `deLElement` dit si elles admettent blason et matière. */
export function lireSurfaces(brut: unknown, deLElement: boolean): { readonly surfaces: Surface[]; readonly ecarts: EcartDeSurface[] } {
  const ecarts: EcartDeSurface[] = [];
  const refus = (code: CodeDEcartDeSurface, ou: string, detail: string) => ecarts.push({ code, ou, detail });
  if (!Array.isArray(brut)) return { surfaces: [], ecarts: [{ code: 'forme', ou: 'surfaces', detail: 'liste attendue' }] };
  const options = deLElement ? ['blason', 'matiere'] : [];
  const attendue = deLElement ? '`{ nom, palette }` attendu, `blason: true` et `matiere` en option' : '`{ nom, palette }` attendu';
  const noms = new Set<string>();
  const surfaces = brut.flatMap((s: unknown, i): Surface[] => {
    const ou = `surfaces.${i}`;
    const autres = estObjet(s) ? Object.keys(s).filter((c) => c !== 'nom' && c !== 'palette' && !options.includes(c)) : [];
    if (!estObjet(s) || typeof s.nom !== 'string' || s.nom === '' || s.palette === undefined || autres.length) {
      refus('forme', ou, attendue);
      return [];
    }
    if (s.blason !== undefined && s.blason !== true) refus('forme', `${ou}.blason`, `${String(s.blason)} : \`true\` ou absent attendu`);
    if (s.matiere !== undefined && (typeof s.matiere !== 'string' || s.matiere === '')) refus('forme', `${ou}.matiere`, `${String(s.matiere)} : nom de matière ou absent attendu`);
    if (noms.has(s.nom)) refus('forme', `${ou}.nom`, `${s.nom} nommée deux fois`);
    noms.add(s.nom);
    if (!estSlot(s.palette)) {
      refus('palette-inconnue', `${ou}.palette`, `${String(s.palette)} : ${SLOTS.map((e) => `\`${e}\``).join(', ')} attendue`);
      return [];
    }
    return [{ nom: s.nom, palette: s.palette, ...(s.blason === true && { blason: true as const }), ...(typeof s.matiere === 'string' && s.matiere !== '' && { matiere: s.matiere }) }];
  });
  return { surfaces, ecarts };
}

/** Les écarts des surfaces `surfaces` aux matières de décor du monde `matieres` (`matieresDeDecor`, surface du noyau) :
 *  une `matiere` qui n'en est pas une. */
export function ecartsAuxMatieres(surfaces: readonly Surface[], matieres: readonly string[]): EcartDeSurface[] {
  return surfaces.flatMap((s, i): EcartDeSurface[] => s.matiere === undefined || matieres.includes(s.matiere) ? []
    : [{ code: 'matiere-inconnue', ou: `surfaces.${i}.matiere`, detail: `${s.matiere} : une matière de décor du monde attendue (\`prop--<id>\`, \`materials.json\`)` }]);
}

/** Les écarts des surfaces `surfaces` au GLB lu `glb` : un matériau qu'il ne nomme pas, un blason sans UV. */
export function ecartsAuGlb(surfaces: readonly Surface[], glb: Pick<ContenuGlb, 'materiaux' | 'materiauxSansUv'>): EcartDeSurface[] {
  return surfaces.flatMap((s, i): EcartDeSurface[] => {
    if (!glb.materiaux.has(s.nom)) return [{ code: 'surface-absente', ou: `surfaces.${i}.nom`, detail: `${s.nom} n’est le nom d’aucun matériau du GLB` }];
    return s.blason && glb.materiauxSansUv.has(s.nom) ? [{ code: 'uv-absente', ou: `surfaces.${i}.blason`, detail: `une primitive du matériau ${s.nom} n’a pas d’attribut \`TEXCOORD_0\` où poser l’emblème` }] : [];
  });
}
