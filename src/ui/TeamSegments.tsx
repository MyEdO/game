/**
 * RENDU UNIQUE d'un texte découpé en SEGMENTS TONÉS PAR CAMP — les noms cités s'affichent en gras,
 * allié (`.nm-ally`) ou ennemi (`.nm-foe`), le reste en texte neutre. Les deux vocabulaires de segments du projet (`NarratedSegment` de la narration de combat,
 * `RecapSegment` d'une ligne de récap) ont la MÊME forme et partagent donc ce rendu — le journal
 * (`NarratedSegments`) et la ligne de récap (`RecapLineRow`) le composent, aucun ne le recopie. Le nom
 * cité est rendu par la primitive `Nom` : il ne se coupe qu'entre ses mots.
 */
import { Nom } from './Nom';

export interface TeamSegment {
  text: string;
  team?: 'ally' | 'enemy';
}

export function TeamSegments({ segments }: { segments: readonly TeamSegment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.team
        ? <b key={i} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}><Nom texte={s.text} /></b>
        : <span key={i}>{s.text}</span>))}
    </>
  );
}
