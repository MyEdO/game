import { cibleMesuree } from '../engine/tests';
import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { nomEnVue } from '../noyau/visionDuGroupe';
import { garanti } from '../lib/garanti';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Sauvegarde d'Initiative d'une PANNE DE VAPEUR « Fuite de vapeur » (MDG 12 l.326-328) : la personne qui
 * s'occupe du moteur teste l'Initiative sous peine d'être ébouillantée (1d10−5 Dégâts min 1, ignorent
 * l'Armure). Modale INFLUENÇABLE (Chance/+1 DR/Pacte/Résilience) — l'ÉCHEC applique l'ébouillantage puis
 * la traversée reprend (`jetValider('fuiteDeVapeur')`). Jet PROPRE de l'acteur (aucun « Annuler » : la panne EST là).
 */
export function SteamSaveModal() {
  const p = useGame((s) => s.pendingSteamSave);
  const party = useGame((s) => s.party);
  const nom = useGame((s) => (s.pendingSteamSave ? nomEnVue(s, s.pendingSteamSave.actorId) : null));
  const roll = useGesteDeJet('jetLancer', 'fuiteDeVapeur');
  const reroll = useGesteDeJet('jetRelancer', 'fuiteDeVapeur');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'fuiteDeVapeur');
  const darkPact = useGesteDeJet('jetPactiser', 'fuiteDeVapeur');
  const forceSuccess = useGesteDeJet('jetForcerLaReussite', 'fuiteDeVapeur');
  const confirm = useGesteDeJet('jetValider', 'fuiteDeVapeur');
  if (!p) return null;
  const actor = party.find((c) => c.id === p.actorId);
  const qui = garanti(nom, p.actorId, 'mécanicien');
  const rolled = p.roll != null;

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: rolled
      ? { combatant: actor, d: testBreakdown(libelleDeTest('initiative'), p.skillValue, { roll: p.roll!, ...cibleMesuree(p), sl: p.sl, success: p.success }, p.difficulty) }
      : { combatant: actor, pending: testPending(libelleDeTest('initiative'), p.skillValue, cibleMesuree(p), p.difficulty) },
    onRoll: roll,
    rerolled: !!p.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: forceSuccess,
  }, {
    fortune: actor?.fortune ?? 0,
    resilience: actor?.resilience ?? 0,
  });

  const actions: RollAction[] = [{ key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' }];
  const text = !rolled
    ? 'Un jet de vapeur jaillit de la chaudière — Test d’Initiative ou ébouillanté.'
    : p.success ? `${qui} esquive le jet de vapeur.` : `${qui} est ébouillanté par le jet de vapeur !`;

  return (
    <RollShell
      flowKey="fuiteDeVapeur"
      stake={flowStakeRef('vapeur-sauvegarde-test')}
      title="Fuite de vapeur — Initiative"
      subtitle={<>panne de vapeur</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={[recapLineOfEvent(ev(p.success ? 'information' : 'etat', text, p.actorId), party)]}
      actions={actions}
    />
  );
}
