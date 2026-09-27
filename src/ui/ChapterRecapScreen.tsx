import { useState } from 'react';
import { useGame } from '../state/store';
import { t } from '../i18n';
import { ScreenShell } from './ScreenShell';
import { ParchmentCard } from './ParchmentCard';
import { Band } from './Band';
import { RecapLineSections } from './RecapLine';
import { XpBadge } from './creator/CreatorStepFrame';
import { useSessionEnd } from './SessionEndModal';
import { GatedAction } from './GatedAction';
import { Grid, Row } from './Layout';

/**
 * RÉCAP DE FIN DE CHAPITRE (#717) — ce que la route retiendra : la chronique DÉRIVÉE (objectifs
 * soldés, tombés en chemin), les PX du chapitre, les lieux révélés, puis la clôture de séance.
 *
 * UN seul écran, DEUX volets : le volet 1 raconte et montre l'étape suivante en APERÇU inerte, le
 * volet 2 la rend interactive (`useSessionEnd`, MÊME formulaire que la modale du menu système) ;
 * le pied de l'écran porte le geste du volet courant.
 * Fermer l'écran (Échap) ne fait qu'AJOURNER : le récap se re-pose au prochain lot d'effets tant que
 * la clôture n'a pas été CONSOMMÉE par « Terminer la séance » (`clotureConsommee`, `store.ts`).
 * « Annuler », dans le volet interactif, AJOURNE lui aussi — il ne clôt rien.
 *
 * COOP : l'invité LIT la chronique (elle se partage à la table) mais ne tourne pas la page — le geste
 * qui ouvre le volet interactif est un `GatedAction` portant sa raison, et sa fermeture n'est qu'un
 * MASQUE local (aucun `set` : `pendingChapterRecap` vient du snapshot de l'hôte).
 */
export function ChapterRecapScreen() {
  const recap = useGame((s) => s.pendingChapterRecap);
  const cloreChapitre = useGame((s) => s.cloreChapitre);
  const ajourner = useGame((s) => s.ajournerChapterRecap);
  const invite = useGame((s) => s.net.mode === 'guest');
  const [volet, setVolet] = useState<1 | 2>(1);
  const [masque, setMasque] = useState(false);
  const seance = useSessionEnd({ apercu: volet === 1, onDone: cloreChapitre, onCancel: ajourner });
  if (!recap || masque) return null;

  return (
    <ScreenShell
      title={<>{recap.titre}{recap.sousTitre ? <small> {recap.sousTitre}</small> : null}</>}
      onClose={invite ? () => setMasque(true) : ajourner}
      closeLabel={invite ? t('chap.masquer') : t('chap.ajourner')}
      body="centered"
      ambiance="veillee"
      etape={volet}
      footer={volet === 1 ? (
        <GatedAction
          id="chap-poursuivre"
          label={t('chap.poursuivre')}
          enabled={!invite}
          reason={t('chap.refusHote')}
          onClick={() => setVolet(2)}
        />
      ) : seance.gestes}
    >
      <Band title={t('chap.chronique')} right={<XpBadge value={recap.px} />}>
        <ParchmentCard>
          {recap.chronique.length > 0
            ? <RecapLineSections lines={recap.chronique} />
            : <p className="empty">{t('chap.chroniqueVide')}</p>}
        </ParchmentCard>
      </Band>
      <Grid min="md" stackBelow={700}>
        <Band title={t('chap.lieux')}>
          {recap.lieux.length > 0
            ? <Row>{recap.lieux.map((l) => <span key={l} className="chip">{l}</span>)}</Row>
            : <p className="empty">{t('chap.lieuxVide')}</p>}
        </Band>
        <Band title={t('chap.tombes')}>
          {recap.tombes.length > 0
            ? <Row>{recap.tombes.map((h) => <span key={h.id} className="chip">{h.label}</span>)}</Row>
            : <p className="empty">{t('chap.tombesVide')}</p>}
        </Band>
      </Grid>
      <Band title={t('chap.seance')}>
        {seance.corps}
      </Band>
    </ScreenShell>
  );
}
