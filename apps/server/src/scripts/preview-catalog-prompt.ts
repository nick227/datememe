import { renderCatalogPrompts } from '../services/CatalogPrompts'
import { catalogConfig, GenerationKind } from '../prompts/catalog/config'
const kind = process.argv[2] as GenerationKind
if (!Object.hasOwn(catalogConfig, kind)) throw new Error('Usage: prompt:preview CONCEPTS|LIST_IDEAS|VALUES|FACETS [JSON input]')
const defaults = { count: catalogConfig[kind].count, brief: 'Everyday interests', existingConceptKeys: [], conceptLabel: 'space', existingListTitles: [], listTitle: 'Favorite Space Movies', listPrompt: 'Which space movies do you love?', entityType: 'Movie', rules: { minItems: 1, maxItems: 5, orderingMode: 'RANKED' }, existingValues: [], rejectedValues: [], entityName: 'Example', verifiedFacts: {}, allowedFacets: {} }
console.log(JSON.stringify(renderCatalogPrompts(kind, { ...defaults, ...JSON.parse(process.argv[3] || '{}') }), null, 2))
