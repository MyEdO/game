import { estModule, sitesDeModule } from './importGraph.mjs';

export const DOSSIERS_DU_RIG = Object.freeze([
  'src/gameIso/rig/',
  'scripts/rig/',
  '.claude/skills/creer-une-creature/',
  '.agents/skills/creer-une-creature/',
]);

const DOSSIERS_CASSE = DOSSIERS_DU_RIG.map((d) => d.toLowerCase());
const GALERIE = /^(?:scripts\/gen-[^/]+-gallery\.mts|public\/[^/]+-gallery\.html)$/;
const GALERIE_D_ICONES = /(?:^|[-/])icon-gallery\.(?:mts|html)$/;
const QC_DU_RIG = /^scripts\/qc\/(?:[^/]+\/)*(?:[^/]*-)?(?:rig|creature|silhouette|quad|bras|aveugle|mesure-volume)(?:[-.][^/]*)?$/;
const CHEMIN_D_IMPORT_DU_RIG = /(?:^|\/)gameiso\/rig\//i;

export const estDuRig = (rel) => {
  const casse = rel.replaceAll('\\', '/').toLowerCase();
  return DOSSIERS_CASSE.some((d) => casse.startsWith(d))
    || (GALERIE.test(casse) && !GALERIE_D_ICONES.test(casse))
    || /^src\/(?:[^/]+\/)*rig[^/]*\.tsx$/.test(casse)
    || QC_DU_RIG.test(casse);
};

export const retoursDuRig = (chemins, lireTexte) => chemins.filter((rel) => {
  if (estDuRig(rel)) return true;
  if (!lireTexte || !estModule(rel)) return false;
  const texte = lireTexte(rel);
  if (!/gameiso\/rig\//i.test(texte)) return false;
  return sitesDeModule(rel, texte).some(({ acquisition, spec }) =>
    acquisition && spec !== null && CHEMIN_D_IMPORT_DU_RIG.test(spec));
});
