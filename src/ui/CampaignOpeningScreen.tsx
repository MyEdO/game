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

/**
 * OUVERTURE CÉRÉMONIELLE d'un chapitre (#717) — le rideau qui se lève AVANT tout HUD : le titre de
 * la campagne, le pitch VERBATIM de la source (donnée `narratif.ouverture`, rendu par `<Prose>` :
 * jamais du texte en dur ici) scellé de cire, la compagnie en figurines RÉELLES, et un seul geste.
 *
 * L'écran ne DÉCIDE de rien : « Prendre la route » borne le chapitre (`acquitterOuverture`) et rend
 * la scène. L'ambiance vient de la DONNÉE, « veillée » à défaut.
 *
 * COOP : l'invité VOIT le rideau (la cérémonie se partage à la table) mais ne le lève pas — le geste
 * est un `GatedAction` qui porte sa raison, doublé de l'inertie de l'action de store (`store.ts`,
 * `acquitterOuverture`) : rien ne mute en local pour mourir au snapshot suivant de l'hôte.
 */
export function CampaignOpeningScreen() {
  const ouv = useGame((s) => s.pendingOuverture);
  const party = useGame((s) => s.party);
  const acquitterOuverture = useGame((s) => s.acquitterOuverture);
  const setScreen = useGame((s) => s.setScreen);
  const invite = useGame((s) => s.net.mode === 'guest');
  if (!ouv) return null;
  const heroes = party.filter((h) => h.kind === 'hero');

  return (
    <ScreenShell
      title={<>{ouv.titre}{ouv.sousTitre ? <small> {ouv.sousTitre}</small> : null}</>}
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
            onClick={acquitterOuverture}
          />
        </>
      }
    >
      {ouv.surtitre && <p className="section-label">{ouv.surtitre}</p>}
      <RuleDivider />
      {ouv.chapitre && <p className="subtitle">{ouv.chapitre}</p>}
      <ParchmentCard seal={{ kind: 'cire' }}>
        <Prose md={ouv.pitch} />
      </ParchmentCard>
      <Band title={t('ouv.compagnie')}>
        <FigRow label={t('ouv.compagnie')}>
          {heroes.map((h) => (
            <FigTile key={h.id} preview={{ hero: h }} label={h.label} sub={careerLabelFor(h)} />
          ))}
        </FigRow>
      </Band>
    </ScreenShell>
  );
}
