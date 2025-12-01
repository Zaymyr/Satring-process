export async function performChatCompletion({
  messages,
  model = 'gpt-5-mini',
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
      // ✅ GPT-5 / GPT-4.1 → param correct
      max_completion_tokens: maxTokens,
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
        content?: string | Array<{ type?: string; text?: string }> | null;
      } | null;
    } | null>;
  };

  const rawContent = payload.choices?.[0]?.message?.content;

  let content: string | undefined;

  if (typeof rawContent === 'string') {
    content = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    const textParts = rawContent
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
    content = textParts.trim() || undefined;
  }

  if (!content) {
    console.error(
      'Réponse OpenAI sans contenu exploitable:',
      JSON.stringify(payload, null, 2)
    );
    throw new Error('Réponse OpenAI vide.');
  }

  return content;
}
