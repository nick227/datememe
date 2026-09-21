import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export class OpenAIService {
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
