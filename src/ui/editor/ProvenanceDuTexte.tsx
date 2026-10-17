/**
 * PROVENANCE d'un texte de campagne (#2001) : copie d'un passage (`source`), adapté d'un passage
 * (`adapteDe`, `grammaire/prose.ts`), ou maison — fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`.
 * Compose `OptionChooser` (seg) et `SourceRefField facultative` ; n'émet jamais les deux références.
 *
 * `copie` : le site offre la copie sous `source`. Sans `copie` (réplique, journal), la copie est une
 * ADRESSE (`descRef`) que l'éditeur ne produit pas : reçue (`adresseUnPassage`), sa prose matérialisée
 * se LIT chez l'hôte (`ProseField lecture`), et le seul geste est « Détacher » (`estDerive`,
 * `compendium/editFields.ts`).
 */
import { useState } from 'react';
import { OptionChooser, type RollSegOption } from '../OptionChooser';
import { SourceRefField } from '../SourceRefField';
import { SourceBadge, adresseAffichee } from '../SourceBadge';
import { Row } from '../Layout';
import { adresseUnPassage, type DescRef, type SourceRef } from '../../data/schemas/grammaire/valeurs';

type Mode = 'copie' | 'adapte' | 'maison';

export type ProvenanceDuTexteProps = {
  /** IDENTITÉ du porteur (même contrat que `SourceRefField`) : la changer repart de `value`. */
  identite: string;
  /** Complément des noms accessibles (« du stade 2 »). */
  sujet: string;
  /** RAISON pour laquelle le site ne peut pas se dire « Adapté » (le mode est alors refusé). */
  adapteRefuse?: string;
} & (
  | {
      copie: true;
      value: { source?: SourceRef; adapteDe?: SourceRef };
      onChange: (patch: { source: SourceRef | undefined; adapteDe: SourceRef | undefined }) => void;
    }
  | {
      copie?: false;
      value: { adapteDe?: SourceRef; desc?: string; descRef?: DescRef };
      onChange: (patch: { adapteDe: SourceRef | undefined } | { desc: string | undefined; descRef: undefined }) => void;
    }
);

const OPTIONS: readonly { mode: Mode; label: string; title: string }[] = [
  { mode: 'copie', label: 'Copie', title: 'Le texte est la copie exacte d’un passage du livre ; la source en donne la page.' },
  { mode: 'adapte', label: 'Adapté', title: 'Le texte reformule un passage du livre ; la référence dit lequel.' },
  { mode: 'maison', label: 'Maison', title: 'Le texte est écrit pour cette campagne, sans passage d’origine.' },
];

const REFUS_ADRESSE = 'Le texte copie un passage du livre : détache-le pour le reformuler.';

/** Le mode CHOISI, et le livre que « Détacher » amorce dans le brouillon d'`adapteDe`, par porteur. */
type Choix = { identite: string; mode: Mode; amorce?: { book: string } };

export function ProvenanceDuTexte(props: ProvenanceDuTexteProps) {
  const { identite, sujet, adapteRefuse } = props;
  const adresse = !props.copie && adresseUnPassage(props.value.descRef) ? props.value.descRef : undefined;
  const portee: Mode | undefined = adresse || (props.copie && props.value.source) ? 'copie' : props.value.adapteDe ? 'adapte' : undefined;
  // Le mode CHOISI tient tant qu'aucune référence n'est portée : un brouillon incomplet n'émet rien.
  const [choix, setChoix] = useState<Choix>({ identite, mode: portee ?? 'maison' });
  if (choix.identite !== identite) setChoix({ identite, mode: portee ?? 'maison' });
  const courant = choix.identite === identite ? choix : undefined;
  const mode = portee ?? courant?.mode ?? 'maison';

  const emettre = (vers: Mode, ref: SourceRef | undefined) => {
    if (props.copie) props.onChange({ source: vers === 'copie' ? ref : undefined, adapteDe: vers === 'adapte' ? ref : undefined });
    else props.onChange({ adapteDe: vers === 'adapte' ? ref : undefined });
  };
  const ref = props.copie ? (props.value.source ?? props.value.adapteDe) : props.value.adapteDe;
  const basculer = (vers: Mode) => {
    if (vers === mode) return;
    setChoix({ identite, mode: vers });
    // La référence portée passe au mode choisi (`source` ↔ `adapteDe`) ; « Maison » la retire.
    if (ref !== undefined) emettre(vers, vers === 'maison' ? undefined : ref);
  };
  const detacher = (a: DescRef) => {
    if (props.copie) return;
    setChoix({ identite, mode: 'adapte', amorce: { book: a.book } });
    props.onChange({ desc: props.value.desc, descRef: undefined });
  };

  const options: RollSegOption[] = OPTIONS.filter((o) => props.copie || adresse || o.mode !== 'copie').map((o) => ({
    key: o.mode,
    label: o.label,
    title: o.title,
    ariaLabel: `${o.label} — provenance ${sujet}`,
    selected: o.mode === mode,
    ...(adresse && o.mode !== 'copie'
      ? { refus: REFUS_ADRESSE }
      : adapteRefuse && o.mode === 'adapte' && mode !== 'adapte'
        ? { refus: adapteRefuse }
        : { onSelect: () => basculer(o.mode) }),
  }));

  return (
    <div className="ed-field">
      <OptionChooser layout="seg" empile groupLabel="Provenance du texte" idPrefix="provenance" options={options} />
      {adresse ? (
        <Row gap="sm">
          <SourceBadge source={adresseAffichee(adresse)} />
          <button type="button" className="btn small" aria-label={`Détacher le texte ${sujet}`} onClick={() => detacher(adresse)}>
            Détacher
          </button>
        </Row>
      ) : (
        mode !== 'maison' && (
          <>
            <SourceRefField
              identite={identite}
              label={mode === 'copie' ? 'Source' : 'Adapté de'}
              facultative
              sujet={sujet}
              value={(mode === 'copie' && props.copie ? props.value.source : props.value.adapteDe) ?? courant?.amorce}
              onChange={(r) => emettre(mode, r)}
            />
            {portee === undefined && <span className="hint">Retenu : texte maison.</span>}
          </>
        )
      )}
    </div>
  );
}
