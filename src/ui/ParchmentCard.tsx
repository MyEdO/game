import type { ReactNode } from 'react';
import { WaxSeal } from './WaxSeal';

/**
 * Carte-parchemin narrative (#371 LOT « moisson n°4 ») — texture `.tx-parchment` (ornaments.css)
 * + sceau de cire optionnel (tirage d100) posé sur le bord + un titre en font-display, pour tout
 * récit ponctuel adossé à un tirage : événement d'interlude, événement de bord en mer, révélation
 * d'entrée de scène, texte d'auteur SCELLÉ (#717). Étalon = `InterludeScreen` (chronique des Événements, #257) — les autres
 * consommateurs COMPOSENT cette même primitive plutôt que de recopier `.tx-parchment` + un sceau.
 */
export function ParchmentCard({ seal, title, tone, attenue, children }: {
  /** Le cachet de la carte — absent = aucun. Deux espèces : le MÉDAILLON d100 (`roll`, le tirage qui a
   *  fait sortir l'événement) et le SCEAU de CIRE (`kind: 'cire'`, #717 : un texte d'auteur scellé,
   *  aucun tirage à montrer) — même primitive, jamais un sceau recodé à côté de la carte. */
  seal?: { label?: string; roll: number } | { kind: 'cire' };
  title?: ReactNode;
  tone?: 'ok' | 'bad' | 'info';
  /** Carte en RETRAIT (une lecture antérieure) : bord et ombre atténués, encre intacte. */
  attenue?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`parchment-card tx-parchment${tone ? ` ${tone}` : ''}`} data-attenue={attenue || undefined}>
      {seal && ('kind' in seal ? (
        <WaxSeal size={52} />
      ) : (
        <div className="parchment-seal" title={`Tirage : ${seal.roll}${seal.label ? ` ${seal.label}` : ''}`}>
          <span className="parchment-seal-roll">{seal.roll}</span>
          {seal.label && <span className="parchment-seal-label">{seal.label}</span>}
        </div>
      ))}
      <div className="parchment-card-body">
        {title && <h3 className="parchment-card-title">{title}</h3>}
        {children}
      </div>
    </article>
  );
}
