import OpenAI from 'openai';
import dotenv from 'dotenv';
import db from '../db/sqlite';

dotenv.config({ quiet: true });

export interface SoulOptions {
  model: string;
  temperature?: number;
}

export class Alma {
  private client: OpenAI;
  private model: string;

  constructor(options: SoulOptions) {
    // Load from DB
    const config = db.prepare('SELECT * FROM factory_config WHERE id = 1').get() as any;
    
    this.client = new OpenAI({
      apiKey: config?.api_key || process.env.API_KEY || process.env.OPENAI_API_KEY || 'no-key',
      baseURL: config?.base_url || process.env.BASE_URL,
    });
    this.model = options.model || config?.soul_model || 'gpt-4o';
  }

  async pensars(prompt: string, systemPrompt?: string, imageUrl?: string): Promise<string> {
    try {
      const messages: any[] = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : [])
      ];

      if (imageUrl) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 4096,
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Erro na Alma:', error);
      throw error;
    }
  }

  async contratar(projetoDesc: string, customSystemPrompt?: string): Promise<any[]> {
    const systemPrompt = customSystemPrompt || `Você é o RH d'A Fábrica. Sua missão é entender a ideia do usuário e contratar os melhores colaboradores para a linha de produção. 
Retorne um JSON com uma lista de colaboradores, cada um com: name, role, expertise, personality.`;
    
    const prompt = `Ideia do Projeto: ${projetoDesc}`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const rawContent = response.choices[0].message.content || '{"colaboradores": []}';
    
    // Try to extract JSON from code blocks if LLM adds them
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const cleanContent = jsonMatch ? jsonMatch[0] : rawContent;

    try {
      const content = JSON.parse(cleanContent);
      return content.colaboradores || [];
    } catch (e) {
      console.error('Falha ao parsear JSON dos agentes:', e);
      return [];
    }
  }
}
