import { env } from '@/lib/utils/env';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ResponseFormat =
  | 'text'
  | 'json_object'
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        schema: Record<string, unknown>;
        strict?: boolean;
      };
    };

type ChatCompletionParams = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: ResponseFormat;
};

export async function performChatCompletion({
  messages,
  model = 'gpt-5-mini',          // ✅ minuscule + cohérent avec ton route
  temperature = 1,
  maxTokens = 650,
  responseFormat = 'text'
}: ChatCompletionParams): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquante pour la génération.');
  }

  const responseFormatPayload =
    responseFormat === 'text'
      ? undefined
      : typeof responseFormat === 'string'
        ? { type: responseFormat }
        : responseFormat;

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
      // ✅ param classique de l'endpoint chat.completions
      max_tokens: maxTokens,
      // ✅ on ne l'envoie que si défini
      ...(responseFormatPayload ? { response_format: responseFormatPayload } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Appel OpenAI en erreur (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        // content peut être soit une string, soit un tableau de "parts"
        content?: string | Array<{ type?: string; text?: string }> | null;
      } | null;
    } | null>;
  };

  const rawContent = payload.choices?.[0]?.message?.content;

  let content: string | undefined;

  if (typeof rawContent === 'string') {
    content = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    // On concatène les morceaux de texte si OpenAI renvoie un tableau
    const textParts = rawContent
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
    content = textParts.trim() || undefined;
  }

  if (!content) {
    // 🔍 log utile pour comprendre ce qui se passe si ça recasse
    console.error('Réponse OpenAI sans contenu exploitable:', JSON.stringify(payload, null, 2));
    throw new Error('Réponse OpenAI vide.');
  }

  return content;
}
