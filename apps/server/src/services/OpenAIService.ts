import OpenAI from 'openai';
import { catalogOutputSchema } from './CatalogPrompts'
import { GenerationKind, generationTimeoutMs } from '../prompts/catalog/config'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export class OpenAIService {
  static async generateCatalog(kind: GenerationKind, prompts: { model: string; systemPrompt: string; userPrompt: string }): Promise<unknown> {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: generationTimeoutMs, maxRetries: 0 })
    const response = await client.chat.completions.create({
      model: prompts.model,
      messages: [{ role: 'system', content: prompts.systemPrompt }, { role: 'user', content: prompts.userPrompt }],
      response_format: { type: 'json_schema', json_schema: { name: `catalog_${kind.toLowerCase()}`, strict: true, schema: catalogOutputSchema(kind) } },
      max_tokens: 8000,
    })
    const choice = response.choices[0]
    if (!choice || choice.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content) throw new Error('Generation was refused or incomplete; no proposals saved')
    return JSON.parse(choice.message.content)
  }

  static async generateListValues(categoryName: string, prompt: string, count: number = 5): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an assistant that generates list items for dating app profiles. Return ONLY a JSON object with a single key "items" containing an array of strings.' },
          { role: 'user', content: `Generate ${count} values for the category "${categoryName}". Context/Prompt: ${prompt}` }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '[]';
      // simple cleanup if it wraps in markdown
      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(cleanContent);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item));
      } else if (parsed.items && Array.isArray(parsed.items)) {
        return parsed.items.map((item: any) => String(item));
      }
      
      return [];
    } catch (error) {
      console.error('OpenAI Error:', error);
      throw new Error('Failed to generate values from OpenAI');
    }
  }
}
