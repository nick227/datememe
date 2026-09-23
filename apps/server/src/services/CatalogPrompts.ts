import { readFileSync } from 'fs'
import { resolve } from 'path'
import { catalogConfig, GenerationKind, generationModel, promptVersion } from '../prompts/catalog/config'

export function renderCatalogPrompts(kind: GenerationKind, input: Record<string, unknown>) {
  const config = catalogConfig[kind]
  const render = (role: string) => readFileSync(resolve(__dirname, `../prompts/catalog/${config.template}.${role}.md`), 'utf8')
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      if (!(key in input)) throw new Error(`Missing prompt variable: ${key}`)
      return typeof input[key] === 'string' ? input[key] as string : JSON.stringify(input[key])
    })
  return { systemPrompt: render('system'), userPrompt: render('user'), model: generationModel, promptVersion }
}

const str = { type: 'string' }
const object = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
export function catalogOutputSchema(kind: GenerationKind) {
  const item = kind === 'CONCEPTS' ? object({ label: str })
    : kind === 'LIST_IDEAS' ? object({ title: str, prompt: str, minItems: { type: 'integer' }, maxItems: { type: 'integer' }, orderingMode: { type: 'string', enum: ['RANKED', 'UNRANKED'] } })
    : kind === 'VALUES' ? object({ name: str, slug: str, details: str })
    : object({ axis: str, value: str, reason: str })
  return object({ items: { type: 'array', items: item } })
}
