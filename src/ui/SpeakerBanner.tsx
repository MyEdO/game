import { forwardRef, type AriaAttributes, type AriaRole, type ReactNode } from 'react';
import type { SceneEntity } from '../noyau/monde/scene';
import { Fleuron } from './Ornaments';

/**
 * Bandeau d'interlocuteur (#371 lot 1) — gabarit visuel UNIQUE d'un PNJ qui s'adresse au joueur :
 * repère (fleuron neutre) + nom + texte.
 *  - `dialogue` : arbre de choix (`DialogueBox`) — zone de choix rendue si fournie ; repère ABSENT
 *    tant qu'aucune entité n'est liée (une ligne narrateur sans repère).
 *  - `boniment` : réplique STATIQUE, sans arbre (marchand, aubergiste…) — repère TOUJOURS montré.
 * La SÉMANTIQUE de la boîte appartient à son porteur (`DialogueBox`, porteur de `useModalA11y`) : le
 * bandeau transmet à sa boîte les attributs ARIA reçus, comme son `ref`, et pose sur le nom et la
 * réplique les ids que le porteur lui donne.
 */
export interface SpeakerBannerProps extends AriaAttributes {
  /** Rôle de la boîte, posé par son porteur. */
  role?: AriaRole;
  /** Entité de scène incarnant l'interlocuteur — absente = pas d'entité liée. */
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
  const showRepere = ent != null || variant === 'boniment';
  return (
    <div ref={ref} {...aria} className={`dialogue-box${variant === 'boniment' ? ' dlg-boniment' : ''}${className ? ` ${className}` : ''}`}>
      <div className="dlg-head">
        {showRepere && (
          <span className="dlg-repere">
            <Fleuron size={14} />
          </span>
        )}
        <div className="dlg-body">
          {label && <div id={labelId} className="dlg-speaker">{label}</div>}
          {children && <div id={textId} className="dlg-text">{children}</div>}
        </div>
      </div>
      {variant === 'dialogue' && choices && <div className="dlg-choices">{choices}</div>}
    </div>
  );
});
