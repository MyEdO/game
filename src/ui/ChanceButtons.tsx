import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { RULE_REF } from '../engine/ruleRefs';
import { fermetureDeLaRelance, fermetureDuBonus, fermetureDuPacte, type RollActorView, type RollInfluenceView } from '../noyau/rollFlowFactory';
import { t } from '../i18n';

/**
 * Boutons de dépense de Chance partagés par les modales de jet (LDB « Destin et Résistance »
 * ch.17 l.22-28) : « Relancer » et « +1 DR » (cumulable), plus le Sombre Pacte (LDB 19 l.17).
 *
 * Aucune FENÊTRE n'est calculée ici : elles vivent au seam, en prédicats purs
 * (`fermetureDeLaRelance`/`fermetureDuBonus`/`fermetureDuPacte`, `noyau/rollFlowFactory.ts`), aux côtés des ops qui les
 * exécutent. Ce composant reçoit les FAITS — ressources du jeteur (`actorView`), état du jet
 * (`roll`) — et rend l'affordance quand le prédicat l'ouvre ET que le verbe est OFFERT : l'offre se
 * lit à la PRÉSENCE du handler, jamais à un booléen fourni par l'appelant.
 *
 * Chaque bouton EST l'affordance de sa règle : son `CodexRef` (`wrap`) l'ENGLOBE et rend le texte
 * de la règle au survol/focus, SANS intercepter le clic de dépense — aucun ⓘ voisin (#1078).
 * Libellés courts normés (rangée « influencer le jet »).
 */
export function ChanceButtons({
  actorView,
  roll,
  onReroll,
  onBonusSL,
  onDarkPact,
}: {
  /** Ressources du jeteur — montées par `actorInfluenceView`. */
  actorView: RollActorView;
  /** État du jet de CETTE rangée (lancé ? propre échec ? déjà relancé ?). */
  roll: RollInfluenceView;
  onReroll: () => void;
  onBonusSL?: () => void;
  /** Absent → ce flux n'offre pas le Sombre Pacte. */
  onDarkPact?: () => void;
}) {
  const { fortune, freeReroll } = actorView;
  const pactBtn = onDarkPact && !fermetureDuPacte(actorView, roll) && (
    <CodexRef category={RULE_REF['sombre-pacte'].category} id={RULE_REF['sombre-pacte'].id} label="Sombre Pacte" wrap>
      <button className="btn btn-resource" onClick={onDarkPact}>
        <Icon id="condition/bleeding" size="sm" /> {t('verbe.darkPact')}
      </button>
    </CodexRef>
  );
  // La relance GRATUITE relève de la Bénédiction de Chance (LDB 41), la payante de la Chance
  // (LDB 12 l.40) : le bouton porte la règle qui l'autorise RÉELLEMENT.
  const rerollRef = freeReroll ? RULE_REF['benediction-de-chance'] : RULE_REF.chance;
  const rerollBtn = !fermetureDeLaRelance(actorView, roll) && (
    <CodexRef category={rerollRef.category} id={rerollRef.id} label={freeReroll ? 'Bénédiction de Chance' : 'Chance'} wrap>
      <button
        className="btn btn-resource"
        onClick={onReroll}
        /* Le « ×N » ne compte que les Points de Chance : le title est la seule surface qui porte
           aussi la contrainte LDB 12 l.40. */
        title={`Relancer le jet raté — une seule relance par Test${freeReroll ? '' : ` (${fortune} Point${fortune > 1 ? 's' : ''} de Chance)`}`}
      >
        {freeReroll ? <><Icon id="faith/prayer" size="sm" /> {t('verbe.reroll')}</> : <><Icon id="resource/fortune" size="sm" /> {t('verbe.reroll')} ×{fortune}</>}
      </button>
    </CodexRef>
  );
  return (
    <>
      {rerollBtn}
      {!fermetureDuBonus(actorView, roll) && onBonusSL && (
        <CodexRef category={RULE_REF.chance.category} id={RULE_REF.chance.id} label="Chance" wrap>
          {/* Le bouton NOMME la ressource qu'il dépense : « +1 DR ×N » nu ne disait pas d'où venait le
              cran (recette : lu comme un Avantage, une Résilience partielle…). Même forme de pool que
              son voisin « Relancer ×N » — le compteur est la réserve de Points de Chance. */}
          <button
            className="btn btn-resource"
            onClick={onBonusSL}
            title={`Dépenser un Point de Chance pour +1 DR (${fortune} restant${fortune > 1 ? 's' : ''})`}
          >
            <Icon id="ui/add" size="sm" /> {t('verbe.bonusSL')} ×{fortune}
          </button>
        </CodexRef>
      )}
      {pactBtn}
    </>
  );
}
