// TÊTES PONDÉRÉES des parties de CI (#5037) : par gate (`nomDeGate`, scripts/gates/gatesDeCi.mjs), les clés de sa liste
// mesurées à 60 s ou plus (`SEUIL_DE_TETE_MS`), clé → durée en ms, relevées au journal de la course `mesure`. `trancher`
// (scripts/test/partition.mjs) les distribue avant l'empreinte. Une table périmée ne coûte que de l'équilibre.
// DONNÉE COMMITTÉE, jamais rapatriée de la CI au moment de trancher : deux parts qui liraient deux références
// trancheraient deux partitions, et une clé jouée par personne.

/** Durée en ms à partir de laquelle une clé entre dans une tête. */
export const SEUIL_DE_TETE_MS = 60_000

export const TETES_DE_PARTIE = {
  // Lignes de module du reporter Vitest des jobs `suite 1/3`..`suite 3/3`.
  test: {
    mesure: { date: '2026-11-25', course: 45571956814 },
    durees: {
      'src/noyau/interlude-prejet.hors-store.test.ts': 472_052,
      'src/comptes-plage.test.ts': 313_984,
      'src/compendium-field-editability-guard-2.test.ts': 197_950,
      'src/compendium-field-editability-guard-6.test.ts': 194_367,
      'src/compendium-field-editability-guard-5.test.ts': 193_284,
      'hotes/godot/asset/element.hors-store.test.ts': 188_254,
      'src/data/field-consumers.test.ts': 179_635,
      'src/compendium-field-editability-guard-14.test.ts': 162_654,
      'src/compendium-field-editability-guard-13.test.ts': 162_412,
      'src/compendium-field-editability-guard-3.test.ts': 162_228,
      'src/compendium-field-editability-guard-12.test.ts': 158_044,
      'hotes/godot/asset/evaluer.cli.hors-store.test.ts': 147_027,
      'src/compendium-field-editability-guard-1.test.ts': 141_995,
      'src/analyse-retention-guard.test.ts': 128_002,
      'src/eslint-ordre-total-et-purete.test.ts': 126_566,
      'src/narratif-field-editability-guard.test.ts': 113_081,
      'src/scene-field-editability-guard.test.ts': 111_962,
      'src/compendium-field-editability-guard-11.test.ts': 110_808,
      'src/compendium-field-editability-guard-7.test.ts': 103_977,
      'src/compendium-field-editability-guard-10.test.ts': 102_340,
      'hotes/godot/asset/tenue.hors-store.test.ts': 96_550,
      'src/carte-field-editability-guard.test.ts': 93_851,
      'src/purete-hote-lint.test.ts': 83_382,
    },
  },
  // Ligne `[durees] node test:hooks` du job `types-hooks`.
  'test:hooks': {
    mesure: { date: '2026-11-25', course: 45571956814 },
    durees: {
      'scripts/guards/comptes-plage.test.mjs': 545_548,
      'scripts/guards/lib/plageStock.test.mjs': 378_215,
      'scripts/guards/lib/racinesBalayees.test.mjs': 194_933,
      'scripts/hooks/canal-outil-guard.test.mjs': 88_163,
      'scripts/mods/murDeMod.test.mjs': 82_717,
    },
  },
  // Un lancement `<recette>|<rendu>` (`rendre`, hotes/godot/construire.mjs), du départ de la copie jetable ou de la
  // clôture qui lui a rendu sa place jusqu'à sa clôture, deux de front, au journal du job `godot-rendus`.
  'godot:rendus': {
    mesure: { date: '2026-11-25', course: 45567469769 },
    durees: {
      'res://recettes/voile-de-la-caraque.gd|forward_plus': 421_563,
      'res://recettes/voile-de-la-barge.gd|forward_plus': 379_921,
      'res://recettes/voile-du-bati.gd|forward_plus': 308_465,
      'res://recettes/voile-du-decor.gd|forward_plus': 222_081,
      'res://recettes/voile-de-la-caraque.gd|gl_compatibility': 166_161,
      'res://recettes/nappe-texturee.gd|forward_plus': 149_666,
      'res://recettes/voile-de-la-barge.gd|gl_compatibility': 138_501,
      'res://recettes/voile-du-bati.gd|gl_compatibility': 92_746,
      'res://recettes/voile-du-decor.gd|gl_compatibility': 78_293,
      'res://recettes/saisons-du-decor.gd|forward_plus': 64_157,
    },
  },
}
