/**
 * LES SURFACES D'UN MODÈLE (#2972, #3086) : chaque surface nomme un matériau du GLB et l'emplacement de palette dont il
 * prend la couleur ; une surface `blason: true` reçoit au montage l'emblème choisi (#3111) et porte l'UV `TEXCOORD_0`.
 * Un élément (`element.ts`) et une base (`manifesteDeBase.ts`) les déclarent ; seul un élément admet le blason.
 */
import { estObjet } from '../../../src/lib/objet.mjs';
import { SLOTS, type Slot } from '../../../src/lib/palette.ts';
import type { ContenuGlb } from './glb.ts';

export interface Surface {
  readonly nom: string;
  readonly palette: Slot;
  readonly blason?: true;
}

export type CodeDEcartDeSurface = 'forme' | 'palette-inconnue' | 'surface-absente' | 'uv-absente';

export interface EcartDeSurface {
  readonly code: CodeDEcartDeSurface;
  readonly ou: string;
  readonly detail: string;
}

const estSlot = (v: unknown): v is Slot => (SLOTS as readonly unknown[]).includes(v);

/** Les surfaces `brut` d'un modèle lues, et leurs écarts de forme ; `blasonAdmis` dit si une surface peut porter l'emblème. */
export function lireSurfaces(brut: unknown, blasonAdmis: boolean): { readonly surfaces: Surface[]; readonly ecarts: EcartDeSurface[] } {
  const ecarts: EcartDeSurface[] = [];
  const refus = (code: CodeDEcartDeSurface, ou: string, detail: string) => ecarts.push({ code, ou, detail });
  if (!Array.isArray(brut)) return { surfaces: [], ecarts: [{ code: 'forme', ou: 'surfaces', detail: 'liste attendue' }] };
  const attendue = blasonAdmis ? '`{ nom, palette }` attendu, `blason: true` en option' : '`{ nom, palette }` attendu';
  const noms = new Set<string>();
  const surfaces = brut.flatMap((s: unknown, i): Surface[] => {
    const ou = `surfaces.${i}`;
    const autres = estObjet(s) ? Object.keys(s).filter((c) => c !== 'nom' && c !== 'palette' && !(blasonAdmis && c === 'blason')) : [];
    if (!estObjet(s) || typeof s.nom !== 'string' || s.nom === '' || s.palette === undefined || autres.length) {
      refus('forme', ou, attendue);
      return [];
    }
    if (s.blason !== undefined && s.blason !== true) refus('forme', `${ou}.blason`, `${String(s.blason)} : \`true\` ou absent attendu`);
    if (noms.has(s.nom)) refus('forme', `${ou}.nom`, `${s.nom} nommée deux fois`);
    noms.add(s.nom);
    if (!estSlot(s.palette)) {
      refus('palette-inconnue', `${ou}.palette`, `${String(s.palette)} : ${SLOTS.map((e) => `\`${e}\``).join(', ')} attendue`);
      return [];
    }
    return [s.blason === true ? { nom: s.nom, palette: s.palette, blason: true } : { nom: s.nom, palette: s.palette }];
  });
  return { surfaces, ecarts };
}

/** Les écarts des surfaces `surfaces` au GLB lu `glb` : un matériau qu'il ne nomme pas, un blason sans UV. */
export function ecartsAuGlb(surfaces: readonly Surface[], glb: Pick<ContenuGlb, 'materiaux' | 'materiauxSansUv'>): EcartDeSurface[] {
  return surfaces.flatMap((s, i): EcartDeSurface[] => {
    if (!glb.materiaux.has(s.nom)) return [{ code: 'surface-absente', ou: `surfaces.${i}.nom`, detail: `${s.nom} n’est le nom d’aucun matériau du GLB` }];
    return s.blason && glb.materiauxSansUv.has(s.nom) ? [{ code: 'uv-absente', ou: `surfaces.${i}.blason`, detail: `une primitive du matériau ${s.nom} n’a pas d’attribut \`TEXCOORD_0\` où poser l’emblème` }] : [];
  });
}
