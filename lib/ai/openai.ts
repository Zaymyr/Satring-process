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

type ChatMessageContentBlock =
  | { type: 'text'; text: string }
  | { type: 'input_text'; input_text: { content: string } }
  | { type: 'output_text'; output_text: { content: string } }
  | { type: 'output_json'; output_json: unknown };

const extractContent = (content: unknown): string | null => {
  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((block) => {
        const textBlock = block as ChatMessageContentBlock;

        if (textBlock.type === 'text') {
          return textBlock.text;
        }

        if (textBlock.type === 'input_text') {
          return textBlock.input_text.content;
        }

        if (textBlock.type === 'output_text') {
          return textBlock.output_text.content;
        }

        if (textBlock.type === 'output_json') {
          try {
            return JSON.stringify(textBlock.output_json);
          } catch (error) {
            console.error('Impossible de sérialiser le bloc JSON OpenAI', error);
            return '';
          }
        }

        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    return text.length > 0 ? text : null;
  }

  return null;
};

export async function performChatCompletion({
  messages,
  model = 'GPT-5-mini',
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
      max_completion_tokens: maxTokens,
      response_format: responseFormatPayload
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Appel OpenAI en erreur (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<
      | {
          message?: {
            content?: string | ChatMessageContentBlock[] | null;
          } | null;
        }
      | null
    >;
  };

  const content = extractContent(payload.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('Réponse OpenAI vide.');
  }

  return content;
}
