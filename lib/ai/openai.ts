import { env } from '@/lib/utils/env';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionParams = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export async function performChatCompletion({
  messages,
  model = 'gpt-4o-mini',
  temperature = 0.7,
  maxTokens = 650
}: ChatCompletionParams): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquante pour la génération.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'text' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Appel OpenAI en erreur (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } | null } | null>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('Réponse OpenAI vide.');
  }

  return content;
}
