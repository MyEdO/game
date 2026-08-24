/**
 * LA TUILE D'UNE CAPACITÉ — matière UNIQUE de « ce qu'un porteur peut faire » dans ce jeu : l'alvéole
 * de la console (`.cc-cell`, combat-console.css). Ses DEUX consommateurs la rendent à l'identique —
 * le pont (`ConsoleCell`) et l'écran des capacités (`EcranCapacites`) — même patron que `FigTile`
 * pour la figurine : UNE définition, aucun second dessin.
 *
 * Purement présentationnelle : elle ne décide RIEN (ni l'offre, ni le geste secondaire, ni le foyer
 * de règle qui l'enveloppe) — elle DESSINE. La matière, les accents de famille (`data-family`), le
 * grisé du refus et l'or de l'armement vivent tous en CSS, à leur unique adresse : aucun style n'est
 * recopié ici, aucune classe n'est créée pour l'écran.
 */
import type { ReactNode, Ref } from 'react';

export interface CaseTuileProps {
  /** ADRESSE de la case (`data-cell`) et ID D'ACTION du registre (`data-action`) — les deux marqueurs
   *  structurels par lesquels toute sonde (garde de surface, test de parité) reconnaît une case. */
  cle: string;
  actionId: string;
  /** FAMILLE : elle porte l'accent de tête de la tuile (attribut de données, jamais une classe). */
  famille: string;
  icone: ReactNode;
  label: string;
  /** NOM ACCESSIBLE (le libellé entier, plus ce que le geste secondaire ajoute). */
  nom: string;
  /** RAISON du refus : copie HORS ÉCRAN, cible de l'`aria-describedby`. Le texte VISIBLE, lui, naît
   *  au survol/focus dans l'infobulle partagée que l'appelant pose autour (`CodexRef refus`). */
  raison?: string;
  gateId?: string;
  /** La raison vient du geste SECONDAIRE (et non de la case) : marqueurs `data-gate-2e`/`data-refus-2e`. */
  raisonDuGeste2e?: boolean;
  /** Case ARMÉE (mode en cours) → l'or de la maison. */
  on?: boolean;
  /** Case DESSINÉE mais non branchée (maquette) → elle se lit MORTE. */
  inert?: boolean;
  /** Case ÉLUE pour lecture (détail de l'écran des capacités) — liseré discret, aucune promesse d'état. */
  elue?: boolean;
  /** Touche imprimée dans la case (grille de la console ; l'écran n'en imprime pas). */
  touche?: number;
  /** Glyphe de coin des gestes secondaires + leurs ids, en structure. */
  glyphe2e?: ReactNode;
  gestes2eIds?: string;
  /** Coût en crans d'Avantage, et l'Avantage COURANT du porteur (crans couverts). */
  adv?: number;
  advantage?: number;
  /** FERMÉE : `disabled` HTML tant qu'elle n'a RIEN à dire ; `aria-disabled` dès qu'elle porte une
   *  RAISON (l'attribut HTML la retirerait du focus, du doigt et du pad — sa raison, qui vit au
   *  survol/focus, ne serait plus lisible qu'à la souris). Le clic reste inerte dans les deux cas. */
  ferme?: boolean;
  fermeParlante?: boolean;
  cellRef?: Ref<HTMLButtonElement>;
  onClick?: () => void;
  onContextMenu?: (e: { preventDefault: () => void }) => void;
  onKeyDown?: (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => void;
  /** Handlers de pointeur de l'appui long (geste secondaire au doigt), tels quels. */
  gestesTactiles?: Record<string, unknown>;
}

export function CaseTuile({
  cle, actionId, famille, icone, label, nom, raison, gateId, raisonDuGeste2e = false,
  on, inert, elue, touche, glyphe2e, gestes2eIds, adv, advantage = 0,
  ferme = false, fermeParlante = false, cellRef, onClick, onContextMenu, onKeyDown, gestesTactiles,
}: CaseTuileProps) {
  return (
    <button
      ref={cellRef}
      type="button"
      data-cell={cle}
      data-action={actionId}
      data-family={famille}
      data-gated={raison ? '' : undefined}
      /* La case qui IMPRIME sa touche lui RÉSERVE sa bande au pied (même patron que la bande de
         raison) : sur un libellé long, le chiffre passait sous les mots (grief du juge vision,
         « Immunité Psychologie (2) »). La géométrie de la case, elle, ne bouge pas. */
      data-hotkey={touche ? '' : undefined}
      data-elue={elue ? '' : undefined}
      aria-disabled={fermeParlante || undefined}
      /* Les gestes SECONDAIRES de l'alvéole, nommés en structure : le geste est un CHEMIN, pas une
         case — c'est le seul marqueur par lequel une sonde (ou la garde de surface) le mesure. */
      data-geste-2e={gestes2eIds}
      className={`chip cc-cell${on ? ' on' : ''}${inert ? ' cc-inert' : ''}`}
      disabled={ferme && !fermeParlante}
      /* Le geste secondaire se DIT dans le nom accessible : un glyphe de coin ne se lit pas au
         lecteur d'écran, et l'infobulle native est proscrite (charte). */
      aria-label={nom}
      aria-describedby={gateId}
      /* `data-gated` dit qu'une raison est portée ; ce marqueur-ci dit LAQUELLE : celle du geste
         secondaire refusé, sur une case qui reste OFFERTE — elle ne s'éteint donc pas. */
      data-refus-2e={raisonDuGeste2e && raison ? '' : undefined}
      onClick={onClick}
      /* Un `contextmenu` qui SUIT un appui long déjà déclenché (le navigateur le dérive de l'appui au
         doigt) est avalé : sans quoi le geste partirait deux fois — et se rebasculerait à N≥2. */
      onContextMenu={onContextMenu}
      /* Touche MENU (et Maj+F10) : le geste secondaire au clavier, sur l'alvéole focalisée. */
      onKeyDown={onKeyDown}
      {...(gestesTactiles ?? null)}
    >
      {touche ? <span className="cc-key">{touche}</span> : null}
      {/* Le geste secondaire SE VOIT : son glyphe gravé au coin de l'alvéole (marqueur structurel,
          comme la bande de touche — aucune classe de plus). */}
      {glyphe2e ? <span data-glyphe-2e="" aria-hidden="true">{glyphe2e}</span> : null}
      <span className="cc-ico">{icone}</span>
      <span className="cc-lbl">{label}</span>
      {/* RAISON d'indisponibilité : lue au SURVOL/FOCUS dans l'infobulle partagée (`CodexRef refus`,
          posée par l'appelant) ; ce qui reste ICI est sa copie HORS ÉCRAN. */}
      {raison ? <span className="hors-ecran" data-gate="" data-gate-2e={raisonDuGeste2e ? '' : undefined} id={gateId}>{raison}</span> : null}
      {adv ? (
        <span className="cc-cost" aria-label={`Coût : ${adv} Avantage (${Math.min(advantage, adv)} couvert${Math.min(advantage, adv) > 1 ? 's' : ''})`}>
          {Array.from({ length: adv }, (_, i) => (
            <i key={i} className={i < advantage ? 'on' : undefined} />
          ))}
        </span>
      ) : null}
    </button>
  );
}
