import { useGame } from '../state/store';
import { availableResistance, resistanceImproves } from '../engine/menace';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { exposureLevelSchema } from '../data/schemas/grammaire/valeurs';
import { testValue } from '../engine/skills';
import { flowStakeRef, refLabel, libelleOuAbsence } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeCorruption } from '../state/flowOutcomes';

/**
 * Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance
 * (Influence physique) ou de Calme (spirituelle) — le gain de Points de Corruption
 * dépend du niveau d'exposition ET du DR, donc la Chance « +1 DR » peut sauver
 * l'âme. Test imposé (pas d'« Annuler »).
 *
 * MÊME modale pour le SEUIL de Corruption (kind 'seuil', LDB 19 l.70) : Test de Résistance
 * au franchissement — succès = contenu « pour cette fois » ; échec = « Je te renie ! »/mutation.
 */
export function CorruptionModal() {
  const pc = useGame((s) => s.pendingCorruption);
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.corruptionRoll);
  const setSkill = useGame((s) => s.corruptionSetSkill);
  const reroll = useGame((s) => s.corruptionReroll);
  const bonusSL = useGame((s) => s.corruptionBonusSL);
  const darkPact = useGame((s) => s.corruptionDarkPact);
  const resistAct = useGame((s) => s.corruptionResist); // Résistance (Menace) : auto-succès du talent (LDB 10)
  const forceSuccess = useGame((s) => s.corruptionForceSuccess); // Résilience (LDB 17 l.68)
  const resolve = useGame((s) => s.resolveCorruption);
  if (!pc) return null;
  const pool = battle?.combatants ?? party;
  const hero = pool.find((c) => c.id === pc.heroId);
  const rolled = pc.roll != null;
  const seuil = pc.kind === 'seuil';
  // Résistance (Menace) (LDB 10 l.1020) : exposition → 'corruption', seuil → 'mutation' (tag posé
  // à l'ouverture). MÊME fenêtre que le verbe `resist` de la fabrique — `resistanceImproves`.
  const resistAvail = pc.menace != null && hero != null && availableResistance(hero, pc.menace) != null
    && resistanceImproves(hero, rolled ? { won: !!pc.success, sl: pc.sl ?? 0 } : null);
  // Pré-jet (audit M6) : `pc.target` n'existe qu'après resolve → base réelle du Test affichée
  // AVANT le jet (même parité que les autres flux).
  const base = hero ? testValue(hero, pc.skill) : 0;
  const skillLabel = refLabel('skills', { id: pc.skill }); // 'Résistance' / 'Calme' (affichage)

  const actorRow: BuiltRollRow = buildRollRow({
    actor: hero,
    row: {
      combatant: hero,
      d: rolled ? testBreakdown(`Test de ${skillLabel}`, base, { roll: pc.roll!, target: pc.target, sl: pc.sl, success: pc.success }, 'intermediaire') : undefined,
      pending: testPending(`Test de ${skillLabel}`, base, undefined, 'intermediaire'),
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
    { key: 'confirm', label: 'Continuer', onClick: resolve, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="corruption"
      stake={flowStakeRef('corruption', seuil ? 'seuil' : (pc.level ?? 'mineure'))}
      title={seuil ? <><Icon id="nav/mutation" size="sm" /> Seuil de Corruption ({hero?.corruption ?? '?'} Points)</> : <><Icon id="nav/mutation" size="sm" /> Influence corruptrice ({libelleDeValeur(exposureLevelSchema, pc.level ?? 'mineure')})</>}
      subtitle={
        <>
          <strong>{libelleOuAbsence(hero, 'heros', pc.heroId)}</strong> — Test de {skillLabel} Intermédiaire (+0)
        </>
      }
      setup={
        // Compétence indéterminée en amont (LDB 19 l.29) → le joueur tranche Résistance/Calme (cf.
        // Défense). Déterminée par la source (`skillLocked`) ou au seuil → pas de choix.
        !seuil && !pc.skillLocked && hero ? (
          <div className="rm-options">
            <OptionChooser
              layout="seg"
              groupLabel="Compétence"
              options={[
                { key: 'resistance', label: refLabel('skills', { id: 'resistance' }), value: testValue(hero, 'resistance'), selected: pc.skill === 'resistance', title: 'Influence physique', onSelect: () => setSkill('resistance') },
                { key: 'calme', label: refLabel('skills', { id: 'calme' }), value: testValue(hero, 'calme'), selected: pc.skill === 'calme', title: 'Corruption spirituelle', onSelect: () => setSkill('calme') },
              ]}
            />
          </div>
        ) : undefined
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(ev('info', describeCorruption(pc, libelleOuAbsence(hero, 'heros', pc.heroId)), pc.heroId), pool)] : undefined}
      actions={actions}
    />
  );
}
