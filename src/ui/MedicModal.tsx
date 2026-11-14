import { Fragment, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../state/store';
import { refusDuChoixNomme } from '../noyau/choixDeFenetre';
import { fermetureDeLaSortie } from '../noyau/sortieDeFenetre';
import { flowStakeRef, skillRefLabel } from '../data';
import { stakeRuleOf } from './StakeNote';
import { CodexRef } from './compendium/CodexRef';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { DrBar } from './DrBar';
import { useHealJetProps } from './jetProps/useHealJetProps';
import { EmbeddedShell, useRollShell } from './RollShell';
import { lodgedAmmoCount, HEAL_MODES, type HealMode } from '../engine/healing';
import { stacks } from '../engine/conditions';
import { plaiesNommees } from '../noyau/medicFlow';
import { bestHealerFor, refusDeLActeALInfirmerie, HEAL_STAKE } from '../noyau/acteDeSoin';
import { refusDuModeDuSoin } from '../noyau/soin';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { toMoney } from '../engine/money';
import { Icon } from './Icon';
import { VsHeader } from './VsHeader';
import { HEAL_ACT } from './healSubtitle';
import { GatedAction } from './GatedAction';
import { useSurgeryJetProps } from './jetProps/useSurgeryJetProps';

const ACT_META: Record<HealMode, { icon: ReactNode; label: string }> = {
  blessures: { icon: <Icon id="journal/soin" size="sm" />, label: 'Soigner les Blessures' },
  hemorragie: { icon: <Icon id="etat/hemorragique" size="sm" />, label: 'Arrêter l’Hémorragie' },
  traumatisme: { icon: <Icon id="medical/dechirure" size="sm" />, label: 'Soigner la déchirure' },
  chirurgie: { icon: <Icon id="medical/scalpel" size="sm" />, label: 'Opérer' },
  reeducation: { icon: <Icon id="medical/bequille" size="sm" />, label: 'Rééduquer un membre' },
  munition: { icon: <Icon id="objet/munition" size="sm" />, label: 'Retirer une munition' },
};

/**
 * INFIRMERIE — modale de soins PERSISTANTE (hors combat) : bandeau patients (tuiles full, la jauge
 * et les pastilles d'États SONT le diagnostic) → dossier du patient (actes : Guérison / Hémorragie /
 * Déchirure / Chirurgie, tarifés chez un PNJ `medicalAid`) → zone de jet embarquée (`useHealJetProps`,
 * `useSurgeryJetProps`), dont la boîte des soins pose les gestes dans SON pied (`useRollShell`).
 * L'acte règle le brouillon du soin (`jetRegler('soins', 'mode')`), que « Lancer » joue. Elle ne se ferme
 * pas après un jet : on enchaîne actes et patients. Le pied porte la sortie de l'état courant
 * (`docs/charte-ui.md`, `.cadre-pied`) : au brouillon, « Terminer » (ou « Arrêter l'opération » pendant une
 * opération armée, en `.danger` dès qu'une passe a abouti, LDB 10 l.184) et « Lancer » ; les gestes du jet
 * lancé ou de la passe (Échap annule la passe, jamais l'opération). La CHIRURGIE est « armée » : DrBar +
 * passes, et Bander/Hémorragie restent des actes normaux du même patient entre deux passes.
 */
export function MedicModal() {
  const medic = useGame((s) => s.medic);
  const ph = useGame((s) => s.pendingHeal);
  const ps = useGame((s) => s.pendingSurgery);
  const party = useGame((s) => s.party);
  const money = partyMoneyTotal(useGame.getState); // somme des bourses (le groupe est abonné via `party`)
  const choisir = useGame((s) => s.fenetreChoisir);
  const sortieFermee = useGame((s) => fermetureDeLaSortie(s, 'infirmerie'));
  const refusDuPatient = useGame(useShallow((s) => Object.fromEntries(s.party.map((h) => [h.id, refusDuChoixNomme(s, 'infirmerie', 'patient', h.id)]))));
  const regler = useGame((s) => s.jetRegler);
  const fermer = useGame((s) => s.fenetreFermer);
  const close = () => fermer('infirmerie');
  const soin = useHealJetProps({ embedded: true });
  const passe = useSurgeryJetProps();
  const jet = useRollShell(soin ?? passe);
  if (!medic) return null;
  const patient = party.find((c) => c.id === medic.patientId) ?? null;
  const sg = medic.surgery;
  const npc = medic.npc;
  const paid = npc?.acts.some((a) => a.cost);

  // Les actes proposés : ceux du PNJ (tarifés) ou tous ceux du groupe — grisés avec la raison du réglage `soins.mode`
  // du brouillon (`refusDuModeDuSoin`), ou de l'infirmerie sans brouillon (`refusDeLActeALInfirmerie`).
  const offers: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[] =
    npc ? npc.acts : HEAL_MODES.map((a) => ({ act: a }));

  // PIED de la fenêtre (`docs/charte-ui.md`, `.cadre-pied`) : les gestes du jet lancé ; au brouillon du soin, ses gestes
  // et la sortie de l'état courant (l'arrêt d'une opération armée, sinon « Terminer »).
  const brouillon = !!ph && ph.roll == null;
  const sortie = sg ? (
    <button className={sg.last ? 'btn btn-ghost danger' : 'btn btn-ghost'} onClick={() => choisir('infirmerie', 'abandon', true)} title={sg.last ? 'Le cumul de DR est perdu' : 'Renoncer (acte remboursé)'}>
      {sg.kind === 'reeducation' ? 'Arrêter la rééducation' : 'Arrêter l’opération'}
    </button>
  ) : (
    <button className="btn" onClick={close}>Terminer</button>
  );
  const footer = <>{(!jet || brouillon) && sortie}{jet?.gestes}</>;

  return (
    <Modal title={npc ? <><Icon id="journal/soin" size="sm" /> Soins — {npc.label}</> : <><Icon id="journal/soin" size="sm" /> Soins</>} onClose={jet && !brouillon ? jet.escClose : sortieFermee ? undefined : close} footer={footer} etape={`${medic.patientId ?? ''}:${sg?.kind ?? ''}`}>
      {paid && <span className="medic-purse hint">Bourse <Coins money={money} ton="discret" /></span>}

      {/* Bandeau PATIENTS : tuile full (jauge + États = le diagnostic), sélection or. */}
      <div className="medic-patients">
        {party.map((h) => (
          <CharFrame
            key={h.id}
            c={h}
            variant="full"
            size="md"
            selected={h.id === medic.patientId}
            onClick={refusDuPatient[h.id] ? undefined : () => choisir('infirmerie', 'patient', h.id)}
            nom={refusDuPatient[h.id] ? `${h.label} — ${refusDuPatient[h.id]}` : h.label}
          />
        ))}
      </div>

      {/* Zone de JET : exclusive tant que le jet posé n'est pas résolu. */}
      {soin && jet && <EmbeddedShell title={jet.titre} etape={jet.etape}>{jet.corps}</EmbeddedShell>}

      {/* DOSSIER du patient : les actes (l'opération en cours s'affiche au-dessus des actes). Pendant
          un jet de soin, il reste MONTÉ, masqué et `inert` : l'acte qui a posé le jet est l'invocateur
          auquel le jet rend le focus (`EmbeddedShell`). */}
      {patient && (
        <div className="medic-dossier" hidden={!!ph && !brouillon} inert={!!ph && !brouillon}>
          {sg && (() => {
            const recovery = sg.kind === 'reeducation';
            const plaies = plaiesNommees(useGame.getState());
            const acte = HEAL_ACT[sg.kind];
            // Le chirurgien n'est un `Combatant` que s'il est du GROUPE : un PNJ tarifé (`healerId`
            // sentinelle, `acteDeSoin.soinDeLActe`) n'a ni portrait ni fiche — son nom EST le titre de la
            // fenêtre (« Soins — <PNJ> »). Sans acteur, `VsHeader` n'a pas d'A→B à rendre (il tairait
            // aussi son `label`) : l'acte et le patient se disent alors en note.
            const surgeon = sg.healerId ? party.find((c) => c.id === sg.healerId) : undefined;
            return (
            <div className="medic-surgery">
              {/* L'A→B de l'opération est la PRIMITIVE d'opposition (`VsHeader`) : soigneur → patient.
                  La Difficulté vit sur la LIGNE du jet (`pending.difficulty`, #1072) et le DR à cumuler
                  sur la `DrBar` ci-dessous : ni l'une ni l'autre ne se réécrit ici. */}
              {surgeon ? (
                <VsHeader
                  actor={surgeon}
                  target={patient}
                  label={acte.label}
                  verb={acte.icon}
                  targetVariant="full"
                />
              ) : (
                <p className="rm-note">{acte.label} — {patient.label}</p>
              )}
              {plaies.length > 1 && (
                <OptionChooser
                  layout="grid"
                  idPrefix="medic-plaie"
                  options={plaies.map(({ uid, libelle }) => ({ key: uid, label: libelle, selected: uid === sg.traumaUid, onSelect: () => choisir('infirmerie', 'plaie', uid) }))}
                />
              )}
              {/* EXCEPTION nommée au site unique `RollRow.extendedDr` (arbitrage user 2026-07-11, verrou
                  `barre-de-dr-site-unique.test.ts`) : cet état d'OPÉRATION ARMÉE est visible AVANT/ENTRE les passes,
                  hors de toute rangée de jet (`useSurgeryJetProps` n'a pas de rangée tant qu'aucune passe n'est
                  ouverte) — ce n'est pas la barre d'UN jet mais le cumul PERSISTANT de l'opération. */}
              <DrBar cum={sg.cumDR} target={sg.drCible} />
              {sg.last && <p className="rm-note">Dernière passe : {sg.last.sl >= 0 ? '+' : ''}{sg.last.sl} DR</p>}
              {/* coût RAW d'une passe de Chirurgie : LDB 10 l.184 (la rééducation Guérison n'inflige rien). */}
              <p className="rm-note">{recovery ? 'Test étendu de Guérison — récupération de l’usage du membre.' : 'Chaque passe inflige 1d10 PB + 1 Hémorragie. À 0 PB, l’opération s’interrompt.'}</p>
              {/* La passe est un jet INFLUENÇABLE (zone embarquée, pied de la fenêtre) ; avant le 1er jet, le pied de la
                  fenêtre porte l'armement et le renoncement. */}
              {!soin && jet && <EmbeddedShell title={jet.titre} etape={jet.etape}>{jet.corps}</EmbeddedShell>}
            </div>
            );
          })()}
          <div className="medic-acts">
            {offers.map(({ act: a, cost }) => {
              const etat = { medic, party, pendingHeal: ph, pendingSurgery: ps, battle: null };
              const raison = (ph ? refusDuModeDuSoin(etat, a) : refusDeLActeALInfirmerie(etat, a)) ?? undefined;
              const healer = npc ? undefined : bestHealerFor(party, a)?.actor;
              const meta = ACT_META[a];
              const pions = a === 'hemorragie' ? stacks(patient, 'hemorragique') : a === 'munition' ? lodgedAmmoCount(patient) : 0;
              // L'acte est SA propre porte de règle (#1078) : le bouton s'englobe dans `CodexRef wrap`,
              // dont la cible est le FOYER de l'enjeu de CE jet (`HEAL_STAKE`) et l'`instance` le nom de
              // l'acte. Un acte qui ARME une opération (`chirurgie`/`reeducation`) n'a pas de cible au Codex avant
              // l'armement, où naît la valeur de son enjeu (`drCible`, `lancerLActeDeSoin`) : le même `CodexRef`
              // reste monté, `category`/`id` absents, et ne s'ouvre que s'il a quelque chose à dire — la
              // raison d'un refus (`refus`), sinon rien.
              const stake = a === 'chirurgie' || a === 'reeducation' ? undefined : flowStakeRef(HEAL_STAKE[a]);
              const rule = stake ? stakeRuleOf(stake) : undefined;
              // La raison d'un refus ne peut PAS naître d'un second `CodexRef` imbriqué dans celui de
              // la porte de règle (une seule infobulle par ancrage) : elle passe par `refus` de CE
              // popover, et l'action prend la forme `reasonId` — sans conteneur ni doublon.
              const rid = `medic-act-${a}`;
              const bouton = (
                <GatedAction
                  id={rid}
                  reasonId={rid}
                  label={<>
                    {meta.icon} {meta.label}
                    {pions > 0 ? ` ×${pions}` : ''}
                    {cost && <span className="medic-price"><Coins money={toMoney(cost)} /></span>}
                  </>}
                  ariaLabel={meta.label}
                  descOfferte={npc ? `Soigné par ${npc.label} · ${skillRefLabel(npc.skill)}` : healer ? `Soigné par ${healer.label}` : undefined}
                  enabled={!raison}
                  onClick={() => regler('soins', 'mode', a)}
                  primary={false}
                  btnClassName="medic-act"
                />
              );
              return (
                <Fragment key={a}>
                  <CodexRef category={rule?.category} id={rule?.id} label={meta.label} instance={meta.label} refus={raison} wrap>{bouton}</CodexRef>
                  {raison && <p className="hors-ecran" id={rid}>{raison}</p>}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

    </Modal>
  );
}
