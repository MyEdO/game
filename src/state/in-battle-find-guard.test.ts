import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanInBattleFind } from '../../scripts/guards/lib/inBattleFind.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « recherche de combattant EN COMBAT par id » (#279, F1 du programme structurel #276).
 * `X.combatants.find((c) => c.id === …)` réinvente `inBattleId(battle, id)`
 * (`src/state/combatants.ts`). Lot 1 a migré ~150 sites de `src/state` (find-par-id EXACT
 * uniquement — les prédicats COMPOSÉS, ex. `c.id === X && c.kind === 'hero'`, ne se réduisent pas
 * à un simple appel de primitive et RESTENT visibles ici, comptés).
 *
 * PÉRIMÈTRE ÉTENDU #410 (2026-07-13) : le scan couvre désormais `src/state` + `src/ui` + `src/gameIso`
 * — l'audit de couverture des gardes a révélé ~85 sites UI/rendu (modales de jet, jetProps, caméra,
 * highlightLayer, useCombatFx…) qui réinventaient le motif SANS être vus (garde jadis limitée à
 * `src/state`, présentant #276 comme fini). Ce STOCK UI/gameIso reste À RÉSORBER par le programme
 * #276 (lots futurs) ; il est GELÉ ici en baseline par-fichier — la garde arrête la CROISSANCE, elle
 * ne migre pas les sites. Toute baisse doit ABAISSER la baseline (cliquet décroissant).
 *
 * Le FOYER de la primitive (`combatants.ts`) est SCANNÉ comme le reste : son unique site est gelé en
 * baseline, pas exempté en bloc — une exemption au FICHIER masquerait tout ajout futur.
 *
 * MODE CLIQUET (patron `hardcode.mjs`/`combat-hardcode-guard.test.ts`) : `BASELINES` gèle, PAR
 * FICHIER, le nombre de sites tolérés au recensement. Le test échoue si un fichier DÉPASSE sa
 * baseline (régression : nouveau find-par-id réinventé) OU si une baseline est devenue trop haute
 * (fichier assaini sans abaissement).
 */

const SCAN_DIRS = ['src/state', 'src/ui', 'src/gameIso'];
const EXCLUDED = (rel: string) => estFichierVitest(rel);

/** Baseline gelée par fichier. src/state (recensement Lot 1, 2026-07-10 — 3 sites résiduels, tous
 *  prédicats COMPOSÉS non réductibles à `inBattleId` seul) ; src/ui + src/gameIso (recensement #410,
 *  2026-07-13 — STOCK à résorber par #276, lots futurs). */
const BASELINES: Record<string, number> = {
  // FOYER de la primitive : l'implémentation d'`inBattleId` EST le motif. Gelée à son site UNIQUE
  // (le cliquet la surveille comme n'importe quel autre fichier) plutôt qu'exemptée en bloc.
  'src/state/combatants.ts': 1,
  // src/state (Lot 1)
  'src/state/combat/recover.ts': 1,
  'src/state/combatFlow.ts': 1,
  'src/state/devtools.ts': 1,
  // src/ui (#410 — stock à résorber par #276)
  'src/ui/ApproachModal.tsx': 1,
  'src/ui/AuContactModal.tsx': 2,
  'src/ui/BattementModal.tsx': 2,
  'src/ui/CampaignView.tsx': 6,
  'src/ui/CharacterSheet.tsx': 1,
  'src/ui/CrewTestModal.tsx': 1,
  'src/ui/DisengageModal.tsx': 2,
  'src/ui/DistraireModal.tsx': 2,
  'src/ui/FateSaveModal.tsx': 1,
  'src/ui/FrenzyModal.tsx': 1,
  'src/ui/GrappleModal.tsx': 2,
  'src/ui/HandGateModal.tsx': 1,
  'src/ui/InitiativeStrip.tsx': 1,
  'src/ui/InspectPanel.tsx': 1,
  'src/ui/jetProps/useAttackJetProps.tsx': 2,
  'src/ui/jetProps/useDefenseJetProps.tsx': 2,
  'src/ui/jetProps/useFumbleJetProps.tsx': 1,
  'src/ui/jetProps/useTrampleJetProps.tsx': 2,
  'src/ui/ManeuverModal.tsx': 1,
  'src/ui/MountTargetModal.tsx': 2,
  'src/ui/ReloadModal.tsx': 1,
  'src/ui/RunModal.tsx': 1,
  'src/ui/ShantyModal.tsx': 1,
  'src/ui/ShipBatteryModal.tsx': 2,
  'src/ui/ShipManeuverModal.tsx': 1,
  'src/ui/ShipSheet.tsx': 2,
  'src/ui/StateRecoveryModal.tsx': 1,
  'src/ui/WardModal.tsx': 1,
  // src/gameIso (#410 — stock à résorber par #276)
  'src/gameIso/builders/highlights.ts': 1,
  'src/gameIso/fx/useCombatFx.ts': 6,
  // -1 (1 → 0) : `state/viewLevel.ts:etageActif` tient l'étage affiché, et son combattant qui joue par
  // `inBattleId` — le `find` local part avec la définition qu'il servait.
  'src/gameIso/stage/MondeDeCampagne.tsx': 0,
  'src/gameIso/stage/AimOverlay.tsx': 1,
  'src/gameIso/stage/CrewTooltip.tsx': 3,
  // -1 (4 → 3) : la mort de la voie de jeu affine (#1176 P3-4, commit C5a) emporte l'aperçu tap-1 de
  // cette couche — son find-par-id de cible part avec lui (le nouvel hôte, `stage/MoveOverlays`,
  // passe par `inBattleId`).
  'src/gameIso/stage/highlightLayer.tsx': 3,
  'src/gameIso/stage/useHoverTargeting.ts': 5,
  'src/gameIso/stage/useStageCamera.ts': 8,
  // -1 (2 → 1) : la chaîne de picking descend en `stage/pickResolve.ts`, dont la branche `combatant`
  // passe par `inBattleId`.
  'src/gameIso/stage/useStagePointer.ts': 1,
  'src/gameIso/stage/ZdeTemplate.tsx': 1,
  'src/gameIso/usePlanAnim.ts': 1,
};

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (EXCLUDED(rel)) continue;
    const n = scanInBattleFind(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « inBattleId » — find-par-id combattant EN COMBAT (cliquet, #279)', () => {
  it('aucun fichier de src/state|ui|gameIso ne dépasse sa baseline gelée', () => {
    const counts = countsByFile();
    const offenders: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const baseline = BASELINES[rel] ?? 0;
      if (n > baseline) offenders.push(`${rel} : ${n} sites (baseline gelée ${baseline})`);
    }
    expect(
      offenders,
      'Nouveau(x) find-par-id réinventé(s) — migrer vers inBattleId(battle, id) ' +
        `(src/state/combatants.ts), ou si prédicat composé légitime AUGMENTER la baseline :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, baseline] of Object.entries(BASELINES)) {
      const n = counts[rel] ?? 0;
      if (n < baseline) stale.push(`${rel} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });
});
