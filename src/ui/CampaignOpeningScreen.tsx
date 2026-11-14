import { useGame } from '../state/store';
import { careerLabelFor } from '../data';
import { t } from '../i18n';
import { ScreenShell } from './ScreenShell';
import { ParchmentCard } from './ParchmentCard';
import { Prose } from './Prose';
import { Band } from './Band';
import { FigRow, FigTile } from './FigTile';
import { RuleDivider } from './Ornaments';
import { GatedAction } from './GatedAction';
import { porteurDeProjet } from './porteurDeProjet';

/**
 * OUVERTURE CÉRÉMONIELLE d'un chapitre (#717) — le rideau qui se lève AVANT tout HUD : le titre de
 * la campagne, le pitch VERBATIM de la source (donnée `narratif.ouverture`, rendu par `<Prose>` :
 * jamais du texte en dur ici) scellé de cire, la compagnie en tuiles d’identité, et un seul geste.
 *
 * L'écran ne DÉCIDE de rien : « Prendre la route » borne le chapitre (`fenetreValider('ouverture')`) et rend
 * la scène. L'ambiance vient de la DONNÉE, « veillée » à défaut.
 *
 * COOP : l'invité VOIT le rideau (la cérémonie se partage à la table) mais ne le lève pas — le geste
 * est un `GatedAction` qui porte sa raison, doublé du refus de la validation de l'hôte chez l'invité
 * (`refusDeLaValidation`, `noyau/validationDeFenetre.ts`) : rien ne mute en local pour mourir au snapshot suivant de l'hôte.
 */
export function CampaignOpeningScreen() {
  const ouv = useGame((s) => s.pendingOuverture);
  const party = useGame((s) => s.party);
  const valider = useGame((s) => s.fenetreValider);
  const setScreen = useGame((s) => s.setScreen);
  const invite = useGame((s) => s.net.mode === 'invite');
  const campaignDoc = useGame((s) => s.campaignDoc);
  if (!ouv) return null;
  const heroes = party.filter((h) => h.kind === 'heros');

  return (
    <ScreenShell
      title={ouv.titre}
      onClose={() => setScreen('party')}
      closeLabel={t('ouv.retour')}
      body="centered"
      ambiance={ouv.ambiance ?? 'veillee'}
      footer={
        <>
          <GatedAction
            id="ouv-prendre-la-route"
            label={t('ouv.prendreLaRoute')}
            enabled={!invite}
            reason={t('ouv.refusHote')}
            onClick={() => valider('ouverture')}
          />
        </>
      }
    >
      {ouv.sousTitre && <Prose md={ouv.sousTitre.texte} paquet porteur={porteurDeProjet({ campaignDoc }, 'narratif.ouverture.sousTitre.texte')} />}
      {ouv.surtitre && <p className="section-label">{ouv.surtitre}</p>}
      <RuleDivider />
      {ouv.chapitre && <p className="subtitle">{ouv.chapitre}</p>}
      <ParchmentCard seal={{ kind: 'cire' }}>
        <Prose md={ouv.pitch} paquet porteur={porteurDeProjet({ campaignDoc }, 'narratif.ouverture.pitch')} />
      </ParchmentCard>
      <Band title={t('ouv.compagnie')}>
        <FigRow label={t('ouv.compagnie')}>
          {heroes.map((h) => (
            <FigTile key={h.id} label={h.label} sub={careerLabelFor(h)} />
          ))}
        </FigRow>
      </Band>
    </ScreenShell>
  );
}
