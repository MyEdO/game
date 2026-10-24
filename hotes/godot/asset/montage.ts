import type { ContenuGlb } from './glb';
import type { ErreurDeManifeste, ManifesteDePersonnage } from './manifeste';
import { estObjet } from '../../../src/hote/formes';

export const ATTACHES = ['main', 'off', 'dos', 'ceinture'] as const;
export type NomDAttache = (typeof ATTACHES)[number];
type Vecteur = readonly [number, number, number];
export interface Attache {
  readonly os: string;
  readonly position: Vecteur;
  readonly rotation: Vecteur;
}
export interface Montage {
  readonly attaches: Readonly<Record<NomDAttache, Attache>>;
  readonly composants: Readonly<Record<string, { readonly prise: 'main' | 'off'; readonly rangement: 'dos' | 'ceinture' }>>;
}
export type ManifesteMontable = ManifesteDePersonnage & { readonly montage: Montage };

const vecteur = (v: unknown): v is Vecteur => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));

export function lireMontage(brut: unknown): { montage?: Montage; erreurs: ErreurDeManifeste[] } {
  const erreurs: ErreurDeManifeste[] = [];
  const forme = (ou: string) => erreurs.push({ code: 'forme', ou, detail: 'déclaration de montage invalide' });
  if (!estObjet(brut) || !estObjet(brut.attaches) || !estObjet(brut.composants)) return { erreurs: [{ code: 'forme', ou: 'montage', detail: 'attaches et composants requis' }] };
  const attaches: Partial<Record<NomDAttache, Attache>> = {};
  for (const nom of ATTACHES) {
    const a = brut.attaches[nom];
    if (!estObjet(a) || typeof a.os !== 'string' || !a.os || !vecteur(a.position) || !vecteur(a.rotation)) forme(`montage.attaches.${nom}`);
    else attaches[nom] = { os: a.os, position: a.position, rotation: a.rotation };
  }
  for (const cle of Object.keys(brut.attaches)) if (!ATTACHES.includes(cle as NomDAttache)) forme(`montage.attaches.${cle}`);
  const composants: Record<string, Montage['composants'][string]> = {};
  for (const [id, c] of Object.entries(brut.composants)) {
    if (!estObjet(c) || (c.prise !== 'main' && c.prise !== 'off') || (c.rangement !== 'dos' && c.rangement !== 'ceinture')) forme(`montage.composants.${id}`);
    else composants[id] = { prise: c.prise, rangement: c.rangement };
  }
  return erreurs.length ? { erreurs } : { montage: { attaches: attaches as Record<NomDAttache, Attache>, composants }, erreurs };
}

export function ecartsDeMontage(m: ManifesteMontable, glb: ContenuGlb): ErreurDeManifeste[] {
  const erreurs: ErreurDeManifeste[] = [];
  for (const [nom, a] of Object.entries(m.montage.attaches)) {
    if (!glb.os.has(a.os)) erreurs.push({ code: 'os-absent', ou: `montage.attaches.${nom}.os`, detail: a.os });
  }
  for (const id of Object.keys(m.montage.composants)) {
    if (!m.components[id] || m.components[id].apparence === null) erreurs.push({ code: 'composant-inconnu', ou: `montage.composants.${id}`, detail: id });
    const pieces = Object.values(m.pieces).filter(p => p.component === id);
    if (!pieces.length) erreurs.push({ code: 'piece-non-rigide', ou: `montage.composants.${id}`, detail: 'aucune pièce' });
    for (const p of pieces) {
      if (!glb.rigides.has(p.node)) erreurs.push({ code: 'piece-non-rigide', ou: `pieces.${p.node}`, detail: p.node });
      else if (glb.parentDesRigides.get(p.node) !== m.montage.attaches[m.montage.composants[id].prise].os) erreurs.push({ code: 'attache-incompatible', ou: `montage.composants.${id}.prise`, detail: p.node });
    }
  }
  return erreurs;
}
