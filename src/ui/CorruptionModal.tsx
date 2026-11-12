import { useGame } from '../state/store';
import { fermeturesDuFlux } from '../noyau/verbesOuverts';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { exposureLevelSchema } from '../data/schemas/grammaire/valeurs';
import { cibleMesuree } from '../engine/tests';
import { ligneDuTestNomme } from '../noyau/rollFlowSpecs';
import { fenetreDeCorruption } from '../noyau/fenetreDeCorruption';
import { flowStakeRef, libelleOuAbsence, type FlowStakeId } from '../data';
import type { ExposureLevel } from '../engine/corruption';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeCorruption } from '../noyau/flowOutcomes';
import { libelleDuTestNomme } from '../noyau/jetsEnVue';
import { useGesteDeJet } from './useGesteDeJet';
import type { ReglagesDuJet } from '../noyau/reglagesDuJet';

/** Enjeu servi par chaque niveau d'exposition (le seuil a le sien). */
const CORRUPTION_STAKE: Record<ExposureLevel, FlowStakeId> = { mineure: 'corruption-mineure', moderee: 'corruption-moderee', majeure: 'corruption-majeure' };

/**
 * Exposition à une Influence corruptrice (LDB 19 l.23-75) : le Test de `pendingCorruption.test` — le gain
 * de Points dépend du niveau d'exposition ET du DR, donc la Chance « +1 DR » peut sauver l'âme. Test
 * imposé (pas d'« Annuler »).
 *
 * MÊME modale pour le SEUIL de Corruption (kind 'seuil', LDB 19 l.70) : succès = contenu « pour cette
 * fois » ; échec = « Je te renie ! »/mutation.
 */
export function CorruptionModal() {
  const pc = useGame((s) => s.pendingCorruption);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'corruption');
  const regler = useGame((s) => s.jetRegler);
  const setNature = (v: ReglagesDuJet['corruption']['nature']) => regler('corruption', 'nature', v);
  const reroll = useGesteDeJet('jetRelancer', 'corruption');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'corruption');
  const darkPact = useGesteDeJet('jetPactiser', 'corruption');
  const resistAct = useGesteDeJet('jetResister', 'corruption'); // Résistance (Menace) : auto-succès du talent (LDB 10)
  const forceSuccess = useGesteDeJet('jetForcerLaReussite', 'corruption'); // Résilience (LDB 17 l.68)
  const resolve = useGesteDeJet('jetValider', 'corruption');
  if (!pc) return null;
  const pool = battle?.combatants ?? party;
  const hero = pool.find((c) => c.id === pc.heroId);
  const rolled = pc.roll != null;
  const seuil = pc.kind === 'seuil';
  // Résistance (Menace) (LDB 10 l.1020) : exposition → 'corruption', seuil → 'mutation' (tag posé
  // à l'ouverture). La fenêtre est le verbe `resister` du flux.
  const resistAvail = pc.menace != null && !fermeturesDuFlux(useGame.getState(), 'corruption').resister;
  // La ligne que le résolveur `corruption` jette ; la nature et la cible de chaque option : `fenetreDeCorruption`.
  const l = hero ? ligneDuTestNomme(hero, pc.test) : null;
  const nature = fenetreDeCorruption(useGame.getState())?.nature ?? null;
  const skillLabel = libelleDuTestNomme(pc.test);

  const actorRow: BuiltRollRow = buildRollRow({
    actor: hero,
    row: {
      combatant: hero,
      d: rolled ? testBreakdown(skillLabel, l?.base ?? 0, { ...pc, roll: pc.roll! }, pc.test.difficulty, l?.mods) : undefined,
      pending: l ? testPending(skillLabel, l.base, cibleMesuree(l), l.difficulty, l.mods) : testPending(skillLabel, 0, undefined, pc.test.difficulty),
    },
    onRoll: roll,
    rerolled: !!pc.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: forceSuccess,
  }, {
    resist: resistAvail ? { menace: pc.menace!, onResist: resistAct } : undefined,
    resilience: hero?.resilience ?? 0,
  });

  const actions: RollAction[] = [
    { key: 'confirmer', label: 'Continuer', onClick: resolve, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="corruption"
      stake={flowStakeRef(seuil ? 'corruption-seuil' : CORRUPTION_STAKE[pc.level ?? 'mineure'])}
      title={seuil ? <><Icon id="navigation/mutation" size="sm" /> Seuil de Corruption ({hero?.corruption ?? '?'} Points)</> : <><Icon id="navigation/mutation" size="sm" /> Influence corruptrice ({libelleDeValeur(exposureLevelSchema, pc.level ?? 'mineure')})</>}
      subtitle={
        <>
          <strong>{libelleOuAbsence(hero, 'heros', pc.heroId)}</strong>
        </>
      }
      setup={
        // Nature indéterminée en amont (LDB 19 l.29) → le joueur tranche entre les Tests de la fiche
        // `influences-corruptrices` (cf. Défense). Imposée par la source (`natureFixee`) ou au seuil → pas de choix.
        nature ? (
          <div className="rm-options">
            <OptionChooser
              layout="seg"
              groupLabel="Compétence"
              options={nature.options.map((o) => ({ key: o.valeur, label: o.competence, value: o.cible, selected: nature.choisie === o.valeur, title: o.libelle, onSelect: () => setNature(o.valeur) }))}
            />
          </div>
        ) : undefined
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(ev('information', describeCorruption(pc, libelleOuAbsence(hero, 'heros', pc.heroId)), pc.heroId), pool)] : undefined}
      actions={actions}
    />
  );
}
