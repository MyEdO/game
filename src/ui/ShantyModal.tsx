import { useGame } from '../state/store';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { findSeaShantyById, flowStakeRef } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';
import { resultLines, freeCons } from '../noyau/rollSeam';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { dureeDeChanson, ligneDeChanson } from '../noyau/shipCrew';
import { cibleMesuree } from '../engine/tests';
import { useGesteDeJet } from './useGesteDeJet';
import type { ReglagesDuJet } from '../noyau/reglagesDuJet';

/**
 * Modale de CHANSON DE MARIN (MDG 09 l.32-40) : le pré-jet est un MENU (OptionChooser) des chansons
 * CONNUES du chanteur, puis « Lancer », puis « Appliquer » sur tout l'équipage. Ligne et durée :
 * `noyau/shipCrew` (`ligneDeChanson`, `dureeDeChanson`).
 */
export function ShantyModal() {
  const p = useGame((s) => s.pendingShanty);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetRoll', 'shanty');
  const reroll = useGesteDeJet('jetReroll', 'shanty');
  const bonus = useGesteDeJet('jetBonusSL', 'shanty');
  const darkPact = useGesteDeJet('jetDarkPact', 'shanty');
  const force = useGesteDeJet('jetForceSuccess', 'shanty');
  const confirm = useGesteDeJet('jetConfirm', 'shanty');
  const cancel = useGesteDeJet('jetCancel', 'shanty');
  const regler = useGame((s) => s.jetRegler);
  const setSong = (v: ReglagesDuJet['shanty']['chanson']) => regler('shanty', 'chanson', v);
  if (!p || !battle) return null;
  const singer = battle.combatants.find((c) => c.id === p.singerId);
  if (!singer) return null;
  const r = p.result;
  const chosen = p.shantyId ? findSeaShantyById(p.shantyId) : undefined;
  const ligne = ligneDeChanson(singer);
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: singer,
    row: {
      combatant: singer,
      d: r ? testBreakdown(libelleDeTest('chant'), ligne.base, r, ligne.difficulty, ligne.mods) : undefined,
      pending: testPending(libelleDeTest('chant'), ligne.base, cibleMesuree(ligne), ligne.difficulty, ligne.mods),
    },
    onRoll: roll,
    rerolled: !!p.rerolled,
    onReroll: reroll,
    onBonusSL: bonus,
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: t('verbe.cancel'), onClick: cancel, verbe: 'cancel' },
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, verbe: 'confirm' },
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
                { text: t('crew.shantyPorte', { shanty: chosen.label, min: dureeDeChanson(r.sl), desc: chosen.desc }), icon: 'audio/music', tone: 'ok' as const },
                ...(chosen.note ? [{ text: `— ${chosen.note}`, tone: 'info' as const }] : []),
              ]
            : [t('crew.shantyAPlat')]))
        : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
