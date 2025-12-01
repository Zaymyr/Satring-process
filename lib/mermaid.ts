import type { Dictionary } from '@/lib/i18n/dictionaries';

export type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
};

export type MermaidErrorMessages = Dictionary['landing']['errors']['mermaid'];

declare global {
  interface Window {
    mermaid?: MermaidAPI;
  }
}

let mermaidLoader: Promise<MermaidAPI> | null = null;

const getExistingScript = () =>
  document.querySelector<HTMLScriptElement>('script[data-mermaid]');

const createScript = () => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.mermaid = 'true';
  return script;
};

export function loadMermaid(messages: MermaidErrorMessages): Promise<MermaidAPI> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error(messages.browserOnly));
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }

  if (!mermaidLoader) {
    mermaidLoader = new Promise((resolve, reject) => {
      const existingScript = getExistingScript();

      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.mermaid) {
            resolve(window.mermaid);
          } else {
            mermaidLoader = null;
            reject(new Error(messages.missingAfterLoad));
          }
        });
        existingScript.addEventListener('error', () => {
          mermaidLoader = null;
          reject(new Error(messages.scriptLoadFailed));
        });
        return;
      }

      const script = createScript();
      script.addEventListener('load', () => {
        if (window.mermaid) {
          resolve(window.mermaid);
        } else {
          mermaidLoader = null;
          reject(new Error(messages.missingAfterLoad));
        }
      });
      script.addEventListener('error', () => {
        mermaidLoader = null;
        reject(new Error(messages.scriptLoadFailed));
      });
      document.head.appendChild(script);
    });
  }

  return mermaidLoader;
}
