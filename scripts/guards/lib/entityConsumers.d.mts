import type { Site } from './stock.mjs';
import type { RegenerationDeStock } from './stockDeSites.mjs';

export const CATEGORY_FILES: Record<string, string>;
export const EXCLUDED_CATEGORY_FILES: Record<string, string>;
export function loadCategoryIds(dataDir: string, files?: Record<string, string>): Record<string, string[]>;
export function orphelinesMesurees(dataDir: string, srcDir: string): Site[];
export function regenerations(sites?: readonly Site[]): RegenerationDeStock[];
export function predicatDeConsommation(dataDir: string, srcDir: string): (cat: string, id: string) => boolean;
export function buildConsumerCorpus(dataDir: string, srcDir: string, files?: Record<string, string>): string;
export function sceneConsumerCorpus(srcDir: string): string;
export function isConsumed(corpus: string, id: string): boolean;
export const META_CATALOG_ENTRIES: ReadonlySet<string>;
export interface FieldPredicateRecognized { category: string; loc: string; predicate: string; matched: string[] }
export interface FieldPredicateSkipped { category: string; loc: string; raw: string; reason: string }
export interface FieldPredicateConsumersResult {
  consumed: Map<string, Set<string>>;
  recognized: FieldPredicateRecognized[];
  skipped: FieldPredicateSkipped[];
}
export function computeFieldPredicateConsumers(dataDir: string, srcDir: string): FieldPredicateConsumersResult;
