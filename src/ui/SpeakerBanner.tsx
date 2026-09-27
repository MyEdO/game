import { forwardRef, type AriaAttributes, type AriaRole, type ReactNode } from 'react';
import type { SceneEntity } from '../state/scene';
import { tokenBodyKind } from '../gameIso/tokenBodyKind';
import { Fleuron } from './Ornaments';

/**
 * Bandeau d'interlocuteur (#371 lot 1) — gabarit visuel UNIQUE d'un PNJ qui s'adresse au joueur :
 * portrait (même pipeline que le rendu iso, `tokenBodyKind` en vue de face) + nom + texte.
 *  - `dialogue` : arbre de choix (`DialogueBox`) — zone de choix rendue si fournie ; portrait ABSENT
 *    tant qu'aucune entité n'est liée (comportement historique : une ligne narrateur sans portrait).
 *  - `boniment` : réplique STATIQUE, sans arbre (marchand, aubergiste…) — portrait TOUJOURS montré,
 *    replié sur un fleuron neutre si aucune entité de scène n'incarne l'interlocuteur.
 * La SÉMANTIQUE de la boîte appartient à son porteur (`DialogueBox`, porteur de `useModalA11y`) : le
 * bandeau transmet à sa boîte les attributs ARIA reçus, comme son `ref`, et pose sur le nom et la
 * réplique les ids que le porteur lui donne.
 */
export interface SpeakerBannerProps extends AriaAttributes {
  /** Rôle de la boîte, posé par son porteur. */
  role?: AriaRole;
  /** Entité de scène incarnant l'interlocuteur (portrait rig) — absente = pas d'entité liée. */
  ent?: SceneEntity;
  label?: ReactNode;
  variant?: 'dialogue' | 'boniment';
  /** Réplique (texte du nœud de dialogue, ou boniment). */
  children?: ReactNode;
  /** Zone de choix (variant `dialogue` seulement). */
  choices?: ReactNode;
  className?: string;
  /** Id posé sur le nom (cible d'un `aria-labelledby`). */
  labelId?: string;
  /** Id posé sur la réplique (cible d'un `aria-describedby`). */
  textId?: string;
}

export const SpeakerBanner = forwardRef<HTMLDivElement, SpeakerBannerProps>(function SpeakerBanner(
  { ent, label, variant = 'dialogue', children, choices, className, labelId, textId, ...aria },
  ref,
) {
  const portrait = ent ? tokenBodyKind({ kind: 'sceneEntity', ent }, 'top') : null;
  const showPortraitSlot = portrait != null || variant === 'boniment';
  return (
    <div ref={ref} {...aria} className={`dialogue-box${variant === 'boniment' ? ' dlg-boniment' : ''}${className ? ` ${className}` : ''}`}>
      <div className="dlg-head">
        {showPortraitSlot && (
          <span className="dlg-portrait">
            {portrait ? (
              <svg viewBox={portrait.portraitBox} preserveAspectRatio="xMidYMid slice">{portrait.body}</svg>
            ) : (
              <Fleuron size={14} />
            )}
          </span>
        )}
        <div className="dlg-body">
          {label && <div id={labelId} className="dlg-speaker">{label}</div>}
          {children && <p id={textId} className="dlg-text">{children}</p>}
        </div>
      </div>
      {variant === 'dialogue' && choices && <div className="dlg-choices">{choices}</div>}
    </div>
  );
});
