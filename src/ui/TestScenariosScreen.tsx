import { useGame } from '../state/store';
import { lancerScenario } from '../state/scenarioFlow';
import { testScenarios, type TestScenario, type ScenarioCategory } from '../scenes/test-scenarios';
import { SCENARIO_SECTIONS } from '../scenes/test-scenarios/_shared';
import { Icon } from './Icon';
import { MenuCard, MenuCardHead } from './MenuCard';
import { Grid, Row, Stack, grow } from './Layout';

type Section = (typeof SCENARIO_SECTIONS)[number];

/** Regroupe les scénarios (déjà triés par `order`) par section, dans l'ordre de `SCENARIO_SECTIONS`. */
function groupBySection(list: TestScenario[]): { section: Section; items: TestScenario[] }[] {
  const byCat = new Map<ScenarioCategory, TestScenario[]>();
  for (const sc of list) {
    const bucket = byCat.get(sc.category) ?? [];
    bucket.push(sc);
    byCat.set(sc.category, bucket);
  }
  return SCENARIO_SECTIONS.filter((s) => byCat.has(s.key)).map((s) => ({ section: s, items: byCat.get(s.key)! }));
}

/** Sous-écran « Scénarios de test » : chaque scénario fixe un groupe et une scène adaptée. */
export function TestScenariosScreen() {
  const setScreen = useGame((s) => s.setScreen);

  return (
    <div className="menu">
      <MenuCard
        large
        header={<MenuCardHead
          lead={<button type="button" className="btn small btn-ghost menu-back" onClick={() => setScreen('menu')}>
            <Icon id="ui/undo" size="sm" /> Retour
          </button>}
          title="Scénarios de test"
          sub="Chaque scénario fixe un groupe et une scène adaptée à ce qu'on vérifie."
        />}
      >
        <Stack gap="xl">
          {groupBySection(testScenarios).map((sec) => (
            <Stack as="section" gap="md" key={sec.section.key}>
              <h2 className="mini-title"><Icon id={sec.section.icon} size="sm" /> {sec.section.label}</h2>
              <Grid min="lg" gap="lg">
                {sec.items.map((sc) => (
                  <Stack className="panel sunken" gap="sm" key={sc.id}>
                    <Row gap="md"><Icon id={sc.icon} size={20} /><strong>{sc.title}</strong></Row>
                    <p className="hint clamp" title={sc.tests} {...grow}>{sc.tests}</p>
                    <p className="hint">{sc.partyNote}</p>
                    {/* Ancrage de RECETTE (#1335) : l'id du scénario, stable au reload — le libellé et
                        l'ordre des cartes ne le sont pas. Aucun effet de style. */}
                    <button className="btn btn-primary" data-testid={`scenario-launch-${sc.id}`} onClick={() => lancerScenario(useGame.getState, useGame.setState, sc)}>
                      Lancer
                    </button>
                  </Stack>
                ))}
              </Grid>
            </Stack>
          ))}
        </Stack>
      </MenuCard>
    </div>
  );
}
