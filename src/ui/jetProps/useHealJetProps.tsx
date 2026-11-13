import { cibleMesuree } from '../../engine/tests';
import { useGame } from '../../state/store';
import { enjeuDuSoin, fenetreDuSoin } from '../../noyau/soin';
import type { ComponentProps } from 'react';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow, type BuiltRollRow } from '../rollRowBuild';
import { OptionChooser } from '../OptionChooser';
import { testBreakdown, testPending } from '../breakdown';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../noyau/combatLog';
import { describeHeal } from '../../noyau/flowOutcomes';
import { nomEnVue } from '../../noyau/visionDuGroupe';
import { garanti } from '../../lib/garanti';
import { lodgedAmmoCount } from '../../engine/healing';
import { stacks } from '../../engine/conditions';
import { Icon } from '../Icon';
import { HEAL_ACT } from '../healSubtitle';
import { VsHeader } from '../VsHeader';
import { libelleDeTest } from '../../noyau/jetsEnVue';
import { t } from '../../i18n';
import { useGesteDeJet } from '../useGesteDeJet';
import type { ReglagesDuJet } from '../../noyau/reglagesDuJet';

/**
 * Flux de jet d'un SOIN (Guérison, LDB 09-Compétences) : « Lancer » → Chance (relance / +1 DR) →
 * Résilience → « Appliquer ». Rend les DONNÉES de la coquille (`RollShellProps`), posées par DEUX hôtes :
 *  - en COMBAT : modale autonome (`HealModal`, via la console — un acte = une Action) ;
 *  - hors combat : l'infirmerie (`MedicModal`, `embedded`), qui pose le jet dans SA boîte
 *    (`useRollShell`) et reste ouverte après « Appliquer ».
 * Le soigneur peut être un PNJ payant : sa Chance/Résilience valent 0 (boutons inertes) ; son tarif se débite au
 * lancer, et le brouillon de l'infirmerie ne s'annule pas (`FLOWS.soins.annulation`).
 */
export function useHealJetProps({ embedded = false }: { embedded?: boolean } = {}): ComponentProps<typeof RollShell> | null {
  const ph = useGame((s) => s.pendingHeal);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const nomCible = useGame((s) => (s.pendingHeal ? nomEnVue(s, s.pendingHeal.targetId) : null));
  const roll = useGesteDeJet('jetLancer', 'soins');
  const reroll = useGesteDeJet('jetRelancer', 'soins');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'soins');
  const darkPact = useGesteDeJet('jetPactiser', 'soins');
  const force = useGesteDeJet('jetForcerLaReussite', 'soins');
  const confirm = useGesteDeJet('jetValider', 'soins');
  const cancel = useGesteDeJet('jetAnnuler', 'soins');
  const regler = useGame((s) => s.jetRegler);
  const setMode = (v: ReglagesDuJet['soins']['mode']) => regler('soins', 'mode', v);
  const setTest = (v: ReglagesDuJet['soins']['test']) => regler('soins', 'test', v);
  const setBandages = (v: ReglagesDuJet['soins']['bandages']) => regler('soins', 'bandages', v);
  if (!ph) return null;
  const nom = garanti(nomCible, ph.targetId, 'cible du soin');
  const fenetre = fenetreDuSoin(useGame.getState());
  const pool = battle?.combatants ?? party; // même flux en combat (file) et hors combat (groupe)
  const healer = pool.find((c) => c.id === ph.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = healer?.fortune ?? 0;
  const target = pool.find((c) => c.id === ph.targetId);
  const rolled = ph.roll != null;
  const acte = HEAL_ACT[ph.mode]; // vocabulaire PARTAGÉ avec le dossier d’opération (MedicModal)

  const wounds = ph.mode === 'blessures';
  const trauma = ph.mode === 'traumatisme';
  const ammo = ph.mode === 'munition';
  // Surface UNIQUE du soin en combat : on a ciblé l'allié sur la carte (mode par défaut) ; si plusieurs
  // soins s'offrent (`fenetreDuSoin.mode`), on choisit ICI, avant le jet. L'infirmerie (embedded) garde
  // son propre choix d'acte → pas de seg.
  const combatModes = !embedded && fenetre ? fenetre.mode.options.flatMap((o) => (o.refus || !o.valeur ? [] : [o.valeur])) : [];
  const bleed = target ? stacks(target, 'hemorragique') : 0;
  const lodged = target ? lodgedAmmoCount(target) : 0;

  // Ligne montée à l'ouverture (`ph.ligne`, Soutien LDB 12 compris).
  const { base, mods: supMods } = ph.ligne;
  const actorRow: BuiltRollRow = buildRollRow({
    actor: healer,
    row: {
      combatant: healer,
      d: rolled ? testBreakdown(libelleDeTest(ph.test), base, { roll: ph.roll!, ...cibleMesuree(ph), sl: ph.sl, success: ph.success }, ph.difficulty, supMods) : undefined,
      pending: testPending(libelleDeTest(ph.test), base, cibleMesuree(ph), ph.difficulty, supMods),
    },
    rerolled: !!ph.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune,
    resilience: healer?.resilience ?? 0,
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return {
    flowKey: 'soins',
    stake: enjeuDuSoin(useGame.getState(), ph),
    title: wounds ? <><Icon id="journal/soin" size="sm" /> Soigner les Blessures</> : trauma ? <><Icon id="medical/dechirure" size="sm" /> Soigner une déchirure</> : ammo ? <><Icon id="objet/munition" size="sm" /> Retirer une munition</> : <><Icon id="etat/hemorragique" size="sm" /> Arrêter l’Hémorragie</>,
    /* A→B canonique (décision utilisateur 2026-08-04) : portraits + flèche annotée de l'acte —
       plus AUCUNE phrase « A soigne B » en sous-titre. Le patient est en `full` : ses pastilles
       d'ÉTATS sont ce que le jet fait bouger (suivre l'Hémorragie passe par passe). EMBARQUÉ
       (infirmerie) : aucun bandeau — la bande `.medic-patients` porte déjà le patient en full et
       l'acte est le bouton qu'on vient de cliquer. Soigneur PNJ tarifé (`healerId` sentinelle de
       `acteDeSoin.soinDeLActe`, aucune fiche) : pas de bandeau dégénéré, l'acte se dit en note (son
       nom est au titre de l'infirmerie). La Difficulté reste la donnée de la LIGNE (#1072). */
    extra: embedded ? undefined : healer
      ? <VsHeader actor={healer} target={target} label={acte.label} verb={acte.icon} targetVariant="full" />
      : <p className="rm-note">{acte.label} — {nom}</p>,
    // Fenêtre du soin (`fenetreDuSoin`) : le Test et les Bandages engagés, chaque option fermée avec sa raison.
    setup: rolled ? undefined : (
      <>
        {fenetre && combatModes.length > 1 && (
          <OptionChooser
            layout="seg"
            groupLabel={fenetre.mode.libelle}
            options={combatModes.map((m) => ({
              key: m,
              label: m === 'blessures'
                ? <><Icon id="journal/soin" size="sm" /> Blessures</>
                : m === 'munition'
                  ? <><Icon id="objet/munition" size="sm" /> Munition ×{lodged}</>
                  : <><Icon id="etat/hemorragique" size="sm" /> Hémorragie ×{bleed}</>,
              selected: ph.mode === m,
              onSelect: () => setMode(m),
            }))}
          />
        )}
        {fenetre && healer && (
          <OptionChooser
            layout="seg"
            groupLabel={fenetre.test.libelle}
            options={fenetre.test.options.map((o) => ({
              key: o.valeur ?? 'aucun', label: o.libelle, selected: fenetre.test.choisie === o.valeur,
              ...(o.refus ? { refus: o.refus } : {}), onSelect: () => o.valeur && setTest(o.valeur),
            }))}
          />
        )}
        {fenetre?.bandages && (
          <OptionChooser
            layout="seg"
            groupLabel={fenetre.bandages.libelle}
            options={fenetre.bandages.options.map((o) => ({
              key: o.valeur ?? 'aucun', label: o.libelle, selected: fenetre.bandages!.choisie === o.valeur,
              ...(o.refus ? { refus: o.refus } : {}), onSelect: () => setBandages(o.valeur),
            }))}
          />
        )}
      </>
    ),
    rows: [actorRow],
    rolled,
    outcome: rolled && target ? [recapLineOfEvent(ev('soin', describeHeal(ph, target, nom), ph.healerId, ph.targetId), pool)] : undefined,
    actions,
    onCancel: rolled ? undefined : cancel,
  };
}
