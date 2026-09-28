import { useGame } from '../state/store';
import { testValue } from '../engine/skills';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { findSeaShantyById, flowStakeRef } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLines, freeCons } from '../state/rollSeam';

/**
 * Modale de CHANSON DE MARIN (Talent, MDG 09 l.32-40) : le pré-jet est un MENU (OptionChooser) des
 * chansons CONNUES du chanteur (specs du Talent — « chaque niveau … apprend une nouvelle chanson »),
 * puis « Lancer » jette le Test de **Divertissement (Chant)** ; « Appliquer » pose l'effet sur tout
 * l'équipage pour « trois minutes plus un nombre de minutes égal au DR » (l.38).
 */
export function ShantyModal() {
  const p = useGame((s) => s.pendingShanty);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.shantyRoll);
  const reroll = useGame((s) => s.shantyReroll);
  const bonus = useGame((s) => s.shantyBonusSL);
  const darkPact = useGame((s) => s.shantyDarkPact);
  const force = useGame((s) => s.shantyForceSuccess);
  const confirm = useGame((s) => s.shantyConfirm);
  const cancel = useGame((s) => s.shantyCancel);
  const setSong = useGame((s) => s.shantySetSong);
  if (!p || !battle) return null;
  const singer = battle.combatants.find((c) => c.id === p.singerId);
  if (!singer) return null;
  const r = p.result;
  const chosen = p.shantyId ? findSeaShantyById(p.shantyId) : undefined;
  const value = testValue(singer, 'divertissement', undefined, 'chant');
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: singer,
    row: {
      combatant: singer,
      d: r ? testBreakdown('Divertissement (Chant)', value, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'intermediaire') : undefined,
      pending: testPending('Divertissement (Chant)', value, undefined, 'intermediaire'),
    },
    onRoll: roll,
    rerolled: !!p.rerolled,
    onReroll: reroll,
    onBonusSL: bonus,
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="shanty"
      stake={flowStakeRef('shanty-roll', p.shantyId ? { entryId: p.shantyId } : undefined)}
      title={<><Icon id="audio/music" size="sm" /> Chanson de marin</>}
      /* Z1 : acteur + le BÉNÉFICIAIRE, qui n'a de portrait nulle part (l'équipage entier). La
         Compétence est le label de la ligne (`Divertissement (Chant)`) — jamais redite ici. */
      subtitle={<><strong>{singer.label}</strong> — pour tout l’équipage</>}
      setup={
        <OptionChooser
          layout="seg"
          groupLabel="Chanson"
          options={knownShanties(singer).map((id) => {
            const s = findSeaShantyById(id);
            // Une chanson connue du marin mais ABSENTE du catalogue est une anomalie de donnée :
            // elle se dit au survol/focus/tap, jamais par un segment muet.
            return {
              key: s?.id ?? id,
              label: s?.label ?? id,
              title: s?.desc,
              refus: s ? undefined : 'Cette chanson n’est pas au catalogue des chansons de bord.',
              selected: !!s && s.id === p.shantyId,
              onSelect: s ? () => setSong(s.id) : undefined,
            };
          })}
        />
      }
      rows={[actorRow]}
      rolled={rolled}
      /* Hiérarchie de l'issue par le TON du modèle, jamais par du JSX : l'effet obtenu porte le ton
         d'une réussite, la précision de la chanson descend en ligne atténuée — ton `info` ÉCRIT ici
         (le rendu par défaut d'une issue est à pleine couleur, #1078 LOT B2). */
      outcome={r && chosen
        ? resultLines(freeCons(r.success
            ? [
                { text: `« ${chosen.label} » porte ${3 + Math.max(0, r.sl)} minute(s) : ${chosen.desc}`, icon: 'audio/music', tone: 'ok' as const },
                ...(chosen.note ? [{ text: `— ${chosen.note}`, tone: 'info' as const }] : []),
              ]
            : ['La chanson tombe à plat — aucun effet (le quart est consommé).']))
        : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
