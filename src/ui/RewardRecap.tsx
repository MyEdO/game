import type { ReactNode } from 'react';
import { Coins } from './Coins';
import { Icon } from './Icon';
import { Row, Stack } from './Layout';
import { toBrass, type Money } from '../engine/money';

/** Une rubrique du récapitulatif : son titre et son contenu. */
export interface RecapSection {
  /** Identité STABLE de la rubrique : la liste est conditionnelle (une rubrique disparaît quand elle se vide). */
  id: string;
  titre: ReactNode;
  /** Rubrique à TOUCHER (#377) : elle se pose sur la surface à liseré or de la charte (`.panel.gold`)
   *  et son titre renonce au filet de séparation, que le cadre remplace. */
  enAvant?: boolean;
  children: ReactNode;
}

/**
 * Récapitulatif de GAIN — messages d'ambiance, récompenses chiffrées, rubriques titrées. Brique
 * partagée de l'écran de VICTOIRE (fin de combat) et de la fenêtre de BUTIN hors combat : les deux
 * montrent la même chose, dans la même forme — celle du corps de toute modale. Le geste de sortie
 * n'est pas à elle : l'hôte le pose dans le pied de son cadre (`Modal` `footer`).
 * Un compteur à ZÉRO ne s'affiche jamais nu (#377) : la brique le masque ELLE-MÊME (PX comme bourse),
 * et `emptyNote` remplace une rangée vide par une ligne narrative.
 */
export function RewardRecap({ messages, xp, gold, emptyNote, sections }: {
  /** Lignes de journal de l'événement (Effets `onVictory`, texte d'ambiance d'une fouille). */
  messages?: readonly ReactNode[];
  /** Points d'Expérience gagnés — rendus au-delà de zéro seulement. */
  xp?: number;
  /** Argent trouvé, déjà crédité — rendu au-delà de zéro seulement. */
  gold?: Money;
  /** Ligne narrative quand il n'y a NI PX NI or. */
  emptyNote?: ReactNode;
  sections?: readonly RecapSection[];
}) {
  const hasXp = (xp ?? 0) > 0;
  const hasGold = !!gold && toBrass(gold) > 0;
  const hasRewards = hasXp || hasGold;
  return (
      <Stack gap="lg">
        {(messages?.length ?? 0) > 0 && (
          <Stack gap="xs">
            {messages!.map((m, i) => <p key={i} className="reward-msg">{m}</p>)}
          </Stack>
        )}

        {hasRewards ? (
          <Row gap="lg">
            {hasXp && (
              <Row gap="md" className="reward-stat"><Icon id="action/cast" size="sm" /> <b>{xp}</b> <span className="reward-unit">PX</span></Row>
            )}
            {hasGold && (
              <Row gap="md" className="reward-stat"><Icon id="resource/gold-purse" size="sm" /> <Coins money={gold!} /></Row>
            )}
          </Row>
        ) : emptyNote ? (
          <p className="reward-msg">{emptyNote}</p>
        ) : null}

        {sections?.map((s) => (
          <div key={s.id} className={s.enAvant ? 'reward-section panel gold' : 'reward-section'} data-avant={s.enAvant || undefined}>
            <h3>{s.titre}</h3>
            {s.children}
          </div>
        ))}
      </Stack>
  );
}
