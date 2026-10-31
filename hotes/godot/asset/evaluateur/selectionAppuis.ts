import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import type { SkinnedMesh } from 'three';
import { CARRURE_MOINS, CARRURE_PLUS, FACTEURS_NEUTRES, poidsDeCarrure, poidsDuGabarit, sensCuitsDuGabarit } from '../gabarit.ts';
import { CLES_DU_GABARIT, type CandidatDAppui, type ManifesteDeBase } from '../manifesteDeBase.ts';
import { chargerScene } from './chargement.ts';
import { copierSommet } from './candidatsDAppui.ts';
import { appliquerGabarit, poserFormes } from './gabarit.ts';
import { echantillonner, PAS_PAR_DEFAUT, poseDeRepos, type Pose } from './echantillonnage.ts';
import { meshesDuCorps } from './corps.ts';

export function grilleDesAppuis(manifeste: Pick<ManifesteDeBase, 'gabarit' | 'silhouettes'>) {
  let facteurs: GabaritResolu[] = [{ ...FACTEURS_NEUTRES }];
  const sens = sensCuitsDuGabarit(manifeste.gabarit.bornes);
  for (const cle of CLES_DU_GABARIT) facteurs = facteurs.flatMap((f) => [FACTEURS_NEUTRES[cle], ...sens.filter((s) => s.cle === cle).map((s) => s.extremite)].map((v) => ({ ...f, [cle]: v })));
  let silhouettes: Record<string, number>[] = [{}];
  for (const nom of manifeste.silhouettes) silhouettes = silhouettes.flatMap((s) => [0, 1].map((v) => ({ ...s, [nom]: v })));
  const carrures = [manifeste.gabarit.st.min, FACTEURS_NEUTRES.st, manifeste.gabarit.st.max].map((st) => poidsDeCarrure(st, manifeste.gabarit.st));
  silhouettes = silhouettes.filter((s) => carrures.some((c) => [CARRURE_MOINS, CARRURE_PLUS].every((nom) => s[nom] === undefined || s[nom] === c[nom])));
  return facteurs.flatMap((f) => silhouettes.map((s) => ({ facteurs: f, silhouettes: s })));
}

export async function selectionnerAppuis(base: Uint8Array, manifeste: Pick<ManifesteDeBase, 'gabarit' | 'silhouettes'>, partition = { indice: 0, nombre: 1 }): Promise<CandidatDAppui[]> {
  if (!Number.isInteger(partition.indice) || !Number.isInteger(partition.nombre) || partition.indice < 0 || partition.nombre < 1 || partition.indice >= partition.nombre) throw new Error('appuis : partition invalide');
  const retenus = new Map<string, CandidatDAppui>();
  const grille = grilleDesAppuis(manifeste);
  for (const [etat, { facteurs, silhouettes }] of grille.entries()) {
    if (etat % partition.nombre !== partition.indice) continue;
    const debut = Date.now();
    console.log(`APPUIS_DEBUT ${etat + 1}/${grille.length} partition=${partition.indice}/${partition.nombre}`);
    const b = await chargerScene(base);
    const meshes = meshesDuCorps(b);
    const corps = meshes.filter((m): m is SkinnedMesh => (m as SkinnedMesh).isSkinnedMesh === true);
    if (corps.length !== meshes.length) throw new Error('appuis : le corps contient un mesh sans skin');
    if (!corps.length) throw new Error('appuis : aucun corps skinné');
    poserFormes(b.scene, { ...silhouettes, ...poidsDuGabarit(facteurs, manifeste.gabarit.bornes, silhouettes) });
    const gabarit = appliquerGabarit(b.scene, facteurs, manifeste, b.squelette ?? undefined, false);
    const choisir = (pose: Pose) => {
      let y = Infinity;
      for (const p of pose.positions.values()) for (let i = 1; i < p.length; i += 3) y = Math.min(y, p[i]);
      for (const [nom, p] of pose.positions) for (let i = 1; i < p.length; i += 3) if (p[i] === y) {
        const indice = (i - 1) / 3, cle = `${nom}/${indice}`;
        if (!retenus.has(cle)) {
          const m = corps.find((m) => m.name === nom);
          if (!m) throw new Error(`appuis : mesh absent ${nom}`);
          retenus.set(cle, copierSommet(m, indice));
        }
      }
    };
    choisir(poseDeRepos(b.scene, corps));
    let precedent = '', clips = 0;
    for (const p of echantillonner(b.scene, corps, b.clips, PAS_PAR_DEFAUT, gabarit)) {
      if (p.clip !== precedent) {
        precedent = p.clip; clips++;
        if (partition.nombre > 1 && clips % Math.max(1, Math.floor(b.clips.length / 4)) === 0) console.log(`APPUIS_CLIPS ${etat + 1}/${grille.length} clips=${clips}/${b.clips.length} ms=${Date.now() - debut}`);
      }
      choisir(p);
    }
    if (partition.nombre > 1) console.log(`APPUIS_CLIPS ${etat + 1}/${grille.length} clips=${clips}/${b.clips.length} ms=${Date.now() - debut}`);
    console.log(`APPUIS ${etat + 1}/${grille.length} candidats=${retenus.size} ms=${Date.now() - debut}`);
  }
  return [...retenus.values()];
}
