import { estTriplet, type Attache } from './attache';
import type { ContenuGlb } from './glb';
import type { ErreurDeManifeste, ManifesteDePersonnage } from './manifeste';
import { estObjet } from '../../../src/hote/formes';
import { SLOTS } from '../../../src/noyau/index';

export const ATTACHES = ['main', 'off', 'dos', 'ceinture'] as const;
export type NomDAttache = (typeof ATTACHES)[number];
export interface EmplacementDeMatiere {
  readonly cle: (typeof SLOTS)[number];
  readonly piece: string;
  readonly surface: number;
}
export interface Montage {
  readonly attaches: Readonly<Record<NomDAttache, Attache>>;
  readonly composants: Readonly<Record<string, { readonly prise: 'main' | 'off'; readonly rangement: 'dos' | 'ceinture'; readonly matieres: readonly EmplacementDeMatiere[] }>>;
}
export type ManifesteMontable = ManifesteDePersonnage & { readonly montage: Montage };

export function lireMontage(brut: unknown): { montage?: Montage; erreurs: ErreurDeManifeste[] } {
  const erreurs: ErreurDeManifeste[] = [];
  const forme = (ou: string) => erreurs.push({ code: 'forme', ou, detail: 'déclaration de montage invalide' });
  if (!estObjet(brut) || !estObjet(brut.attaches) || !estObjet(brut.composants)) return { erreurs: [{ code: 'forme', ou: 'montage', detail: 'attaches et composants requis' }] };
  const attaches: Partial<Record<NomDAttache, Attache>> = {};
  for (const nom of ATTACHES) {
    const a = brut.attaches[nom];
    if (!estObjet(a) || typeof a.os !== 'string' || !a.os || !estTriplet(a.position) || !estTriplet(a.rotation)) forme(`montage.attaches.${nom}`);
    else attaches[nom] = { os: a.os, position: a.position, rotation: a.rotation };
  }
  for (const cle of Object.keys(brut.attaches)) if (!ATTACHES.includes(cle as NomDAttache)) forme(`montage.attaches.${cle}`);
  const composants: Record<string, Montage['composants'][string]> = {};
  for (const [id, c] of Object.entries(brut.composants)) {
    if (!estObjet(c) || (c.prise !== 'main' && c.prise !== 'off') || (c.rangement !== 'dos' && c.rangement !== 'ceinture')) forme(`montage.composants.${id}`);
    else {
      const matieres: EmplacementDeMatiere[] = [];
      if (!Array.isArray(c.matieres) || !c.matieres.length) forme(`montage.composants.${id}.matieres`);
      else for (const [i, liaison] of c.matieres.entries()) {
        if (!estObjet(liaison) || !SLOTS.includes(liaison.cle as EmplacementDeMatiere['cle']) || typeof liaison.piece !== 'string' || !liaison.piece || typeof liaison.surface !== 'number' || !Number.isSafeInteger(liaison.surface) || liaison.surface < 0) forme(`montage.composants.${id}.matieres.${i}`);
        else matieres.push({ cle: liaison.cle as EmplacementDeMatiere['cle'], piece: liaison.piece, surface: liaison.surface });
      }
      composants[id] = { prise: c.prise, rangement: c.rangement, matieres };
    }
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
    const surfaces = new Set<string>();
    for (const liaison of m.montage.composants[id].matieres) {
      const ou = `montage.composants.${id}.matieres`;
      if (!pieces.some(p => p.node === liaison.piece) || glb.materiauxParPiece.get(liaison.piece)?.[liaison.surface] == null) erreurs.push({ code: 'matiere-absente', ou, detail: `${liaison.piece}/${liaison.surface}` });
      const surface = JSON.stringify([liaison.piece, liaison.surface]);
      if (surfaces.has(surface)) erreurs.push({ code: 'matiere-ambigue', ou, detail: surface });
      surfaces.add(surface);
    }
    if (!pieces.length) erreurs.push({ code: 'piece-non-rigide', ou: `montage.composants.${id}`, detail: 'aucune pièce' });
    for (const p of pieces) {
      const noeuds = glb.meshes.filter(n => n.nom === p.node);
      if (!noeuds.length || noeuds.some(n => n.skinne)) erreurs.push({ code: 'piece-non-rigide', ou: `pieces.${p.node}`, detail: p.node });
      else if (noeuds.some(n => n.os !== m.montage.attaches[m.montage.composants[id].prise].os)) erreurs.push({ code: 'attache-incompatible', ou: `montage.composants.${id}.prise`, detail: p.node });
    }
  }
  return erreurs;
}
