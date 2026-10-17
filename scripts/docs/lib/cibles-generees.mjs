import { correspondGlob } from '../../guards/lib/lister.mjs'
import { MOTIF_CATALOGUES } from '../../raw/motif-catalogues.mjs'
import { SORTIES as SORTIES_DU_REGISTRE, SORTIE_FORMATS as SORTIE_DES_FORMATS } from './cibles-registres.mjs'

/** `{ runner, script, targets, injecte }` — `runner` = 'node' | 'tsx' ; `targets` = fichiers ÉCRITS
 *  EN ENTIER (glob toléré), jamais commités (`ciblesPures`) ; `injecte` = fichiers commités
 *  dont le générateur ne réécrit QU'UN BLOC (il les relit, ils ne sont donc pas ses sources).
 *  Tout générateur sait `--check` : un de plus coûte une ligne ici, et rien d'autre.
 *  Tout générateur exporte `rendre()` : cible (chemin relatif POSIX) → texte, sans écrire ; il n'écrit
 *  que sous sa porte `import.meta.main`. Un lecteur du texte d'une cible passe par `rendreCible`.
 *  Ordre = ordre d'exécution. */
export const GENERATORS = [
  { runner: 'node', script: 'scripts/gen-registry.mjs', targets: SORTIES_DU_REGISTRE },
  { runner: 'node', script: 'scripts/gen-formats.mjs', targets: [SORTIE_DES_FORMATS] },
  { runner: 'node', script: 'scripts/raw/build-atlas-index.mjs', targets: [], injecte: ['docs/raw/**/00-index.md'] },
  { runner: 'node', script: 'scripts/raw/build-catalogs.mjs', targets: [MOTIF_CATALOGUES] },
  { runner: 'node', script: 'scripts/raw/build-implemente.mjs', targets: [], injecte: ['docs/raw/**/*.md'] },
  { runner: 'node', script: 'scripts/docs/build-primitives.mjs', targets: ['docs/primitives.md'] },
  { runner: 'node', script: 'scripts/docs/build-systemes.mjs', targets: ['docs/systemes.md'] },
  { runner: 'node', script: 'scripts/docs/build-donnees.mjs', targets: ['docs/donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-sources-vf.mjs', targets: ['docs/sources-vf.md'] },
  { runner: 'node', script: 'scripts/docs/build-effects.mjs', targets: ['docs/campagne-effects.md'] },
  { runner: 'node', script: 'scripts/docs/build-vocabulaire.mjs', targets: ['docs/vocabulaire-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-index-moteur.mjs', targets: ['docs/index-moteur.md'] },
  { runner: 'node', script: 'scripts/docs/build-registre-jets.mjs', targets: ['docs/registre-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-usages-jets.mjs', targets: ['docs/usages-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-entity-orphans.mjs', targets: ['docs/orphelines-donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-test-scenarios.mjs', targets: ['docs/test-scenarios.md'] },
  { runner: 'node', script: 'scripts/docs/build-reprise.mjs', targets: ['docs/reprise-apres-pause.md'] },
  { runner: 'node', script: 'scripts/docs/build-icones.mjs', targets: ['docs/ajouter-une-icone.md'] },
  { runner: 'node', script: 'scripts/docs/build-codex-relations.mjs', targets: ['docs/codex-relations.md'] },
  { runner: 'node', script: 'scripts/docs/build-map-authoring.mjs', targets: ['docs/map-authoring.md'] },
  { runner: 'node', script: 'scripts/docs/build-passifs.mjs', targets: ['docs/systeme-passifs.md'] },
  { runner: 'node', script: 'scripts/docs/build-rendu-pipeline.mjs', targets: ['docs/rendu-pipeline.md'] },
  { runner: 'node', script: 'scripts/docs/build-flux-de-jet.mjs', targets: ['docs/ajouter-un-flux-de-jet.md'] },
  { runner: 'node', script: 'scripts/docs/build-mecanique.mjs', targets: ['docs/ajouter-une-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-sort.mjs', targets: ['docs/ajouter-un-sort.md'] },
  { runner: 'node', script: 'scripts/docs/build-ajouter-donnee.mjs', targets: ['docs/ajouter-une-donnee.md'] },
  { runner: 'node', script: 'scripts/docs/build-regles-optionnelles.mjs', targets: ['docs/regles-optionnelles.md'] },
  { runner: 'node', script: 'scripts/docs/build-doctrines.mjs', targets: ['docs/doctrines.md'] },
  { runner: 'node', script: 'scripts/docs/build-dossiers-de-chapitre.mjs', targets: ['docs/dossiers-de-chapitre.md'] },
  { runner: 'tsx', script: 'scripts/gen-sorts-doc.mts', targets: ['docs/sorts-implementation.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-field-consumers.mts', targets: ['docs/consommateurs-de-champs.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-structures.mts', targets: ['docs/structures-donnees.md'] },
  { runner: 'node', script: 'scripts/raw/coverage.mjs', targets: ['docs/raw/coverage.md'] },
  { runner: 'node', script: 'scripts/raw/reconcile.mjs', targets: ['docs/raw/reconciliation.md'] },
  { runner: 'node', script: 'scripts/raw/reanchor.mjs', targets: ['docs/raw/reanchor.md'] },
]

/** Chemin du dérivé LOCAL qui porte les sets MESURÉS, un par générateur. */
export const SOURCES_LUES = 'docs/.sources-lues.json'

export const estCiblePure = (chemin, generateurs = GENERATORS) =>
  chemin === SOURCES_LUES || generateurs.some((g) => g.targets.some((motif) => correspondGlob(chemin, motif)))
