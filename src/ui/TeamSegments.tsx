/**
 * RENDU UNIQUE d'un texte découpé en SEGMENTS TONÉS PAR CAMP — les noms cités s'affichent en gras,
 * allié (`.nm-ally`) ou ennemi (`.nm-foe`), le reste en texte neutre. Module FEUILLE (aucun import) :
 * les deux vocabulaires de segments du projet (`NarratedSegment` de la narration de combat,
 * `RecapSegment` d'une ligne de récap) ont la MÊME forme et partagent donc ce rendu — le journal
 * (`NarratedSegments`) et la ligne de récap (`RecapLineRow`) le composent, aucun ne le recopie.
 */
export interface TeamSegment {
  text: string;
  team?: 'ally' | 'enemy';
}

/** Un nom se coupe entre ses MOTS, jamais dans un mot composé (« Pierre-de-Fer ») : chaque mot est une
 *  boîte insécable (team-segments.css) — R-M2, docs/plans/2026-08-16-spec-hud-combat.md:71-74. */
function Nom({ texte }: { texte: string }) {
  return <>{texte.split(' ').map((mot, j) => <span key={j}>{j > 0 ? ' ' : ''}<span>{mot}</span></span>)}</>;
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
