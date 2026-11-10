import { z } from 'genkit';
import { ai, localModel } from './genkit';
import { callLocalAI, extractJSON } from './local-ai';

/**
 * ============================================================================
 * ASTRO AI — CENTRALIZED HYBRID AI PROVIDER ARCHITECTURE
 * ============================================================================
 * 
 * Provides a unified, local-first, cloud-optional execution layer for all
 * AI features across Astro AI.
 * 
 * Providers:
 * - 'local': TinyLlama-1.1B on FastAPI (LOCAL_AI_URL, default http://localhost:8000)
 * - 'gemini': Google Gemini 2.0 Flash (GOOGLE_GENAI_API_KEY)
 * - 'auto': Cloud Gemini if key configured, otherwise Local AI
 */

export type AICapability = 
  | 'text-generation'
  | 'structured-json'
  | 'multimodal-vision'
  | 'audio-tts'
  | 'video-generation'
  | 'qr-code'
  | 'youtube-search';

export type AIProviderType = 'local' | 'gemini' | 'auto';

export class UnsupportedCapabilityError extends Error {
  capability: AICapability;
  provider: AIProviderType;

  constructor(capability: AICapability, provider: AIProviderType, customMessage?: string) {
    const msg = customMessage || 
      `Capability "${capability}" is not supported by provider "${provider}". A cloud provider (Google Gemini) with valid GOOGLE_GENAI_API_KEY is required for this operation.`;
    super(msg);
    this.name = 'UnsupportedCapabilityError';
    this.capability = capability;
    this.provider = provider;
  }
}

export class AIProviderUnavailableError extends Error {
  provider: AIProviderType;

  constructor(provider: AIProviderType, reason: string) {
    super(`AI Provider "${provider}" is currently unavailable: ${reason}`);
    this.name = 'AIProviderUnavailableError';
    this.provider = provider;
  }
}

/**
 * Model Capability Matrix
 */
export const CAPABILITY_MATRIX: Record<AIProviderType, Record<AICapability, boolean>> = {
  local: {
    'text-generation': true,
    'structured-json': true, // Supported via TinyLlama instruction prompt and JSON repair
    'multimodal-vision': false, // TinyLlama 1.1B is a text-only LLM
    'audio-tts': false, // No local TTS engine
    'video-generation': false, // Video requires enterprise cloud model
    'qr-code': true,
    'youtube-search': true,
  },
  gemini: {
    'text-generation': true,
    'structured-json': true,
    'multimodal-vision': true,
    'audio-tts': true,
    'video-generation': false, // Gated/Restricted on standard AI Studio API keys
    'qr-code': true,
    'youtube-search': true,
  },
  auto: {
    'text-generation': true,
    'structured-json': true,
    'multimodal-vision': true, // When cloud key present
    'audio-tts': true, // When cloud key present
    'video-generation': false,
    'qr-code': true,
    'youtube-search': true,
  }
};

/**
 * Resolves the active AI provider based on server environment and request capability
 */
export function getActiveProvider(): {
  provider: AIProviderType;
  hasCloudKey: boolean;
  localUrl: string;
} {
  const configuredProvider = (process.env.AI_PROVIDER || 'auto').toLowerCase() as AIProviderType;
  const cloudKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const hasCloudKey = !!(cloudKey && cloudKey.trim().length > 0 && cloudKey !== 'NO_KEY_PROVIDED');
  const localUrl = (process.env.LOCAL_AI_URL || 'http://localhost:8000').replace(/\/+$/, '');

  let resolvedProvider: AIProviderType = 'local';
  if (configuredProvider === 'gemini') {
    resolvedProvider = 'gemini';
  } else if (configuredProvider === 'local') {
    resolvedProvider = 'local';
  } else {
    // 'auto' policy: local-first default, cloud if configured
    resolvedProvider = hasCloudKey ? 'gemini' : 'local';
  }

  return {
    provider: resolvedProvider,
    hasCloudKey,
    localUrl
  };
}

/**
 * Checks local AI server health
 */
export async function checkLocalAIHealth(timeoutMs = 2500): Promise<{
  healthy: boolean;
  model?: string;
  error?: string;
}> {
  const { localUrl } = getActiveProvider();
  const baseHealthUrl = localUrl.replace(/\/generate$/, '');
  
  try {
    const res = await fetch(`${baseHealthUrl}/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store'
    });
    
    if (!res.ok) {
      return { healthy: false, error: `Server returned HTTP ${res.status}` };
    }
    
    const data = await res.json();
    return {
      healthy: data.status === 'ready',
      model: data.model || 'TinyLlama-Finetuned'
    };
  } catch (err: any) {
    return { healthy: false, error: err.message || 'Connection refused or timed out' };
  }
}

/**
 * Asserts whether a capability is supported by the active configuration
 */
export function assertCapability(capability: AICapability): void {
  const { provider, hasCloudKey } = getActiveProvider();

  if (capability === 'multimodal-vision' || capability === 'audio-tts') {
    if (!hasCloudKey) {
      throw new UnsupportedCapabilityError(
        capability,
        'local',
        `The "${capability}" feature requires a multimodal cloud model. No Google GenAI API key is configured. Please add GOOGLE_GENAI_API_KEY to .env.local to enable this capability.`
      );
    }
  }

  if (capability === 'video-generation') {
    throw new UnsupportedCapabilityError(
      capability,
      provider,
      `Video generation (Veo 3.1) is currently restricted to private enterprise preview on Google Cloud and is not available via standard API keys.`
    );
  }

  if (!CAPABILITY_MATRIX[provider][capability]) {
    throw new UnsupportedCapabilityError(capability, provider);
  }
}

/**
 * Centralized Text Generation Execution
 */
export async function executeTextGeneration(options: {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  capability?: AICapability;
}): Promise<string> {
  const capability = options.capability || 'text-generation';
  assertCapability(capability);

  const { provider, hasCloudKey } = getActiveProvider();

  // Try Gemini if cloud provider selected or active in auto mode
  if (provider === 'gemini' || (provider === 'auto' && hasCloudKey)) {
    if (!hasCloudKey) {
      throw new AIProviderUnavailableError('gemini', 'GOOGLE_GENAI_API_KEY is not configured in .env.local.');
    }
    
    try {
      console.log(`🌐 [Central Provider: Gemini] Generating text...`);
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: options.prompt,
        config: {
          temperature: options.temperature ?? 0.7,
        }
      });
      const text = response.text;
      if (text && text.trim().length > 0) {
        return text.trim();
      }
      throw new Error('Gemini returned an empty text response.');
    } catch (geminiError: any) {
      console.warn(`⚠️ [Central Provider] Gemini execution failed: ${geminiError.message}`);
      // Fallback to local if in auto mode
      if (provider !== 'gemini') {
        console.log(`📡 [Central Provider] Falling back to local TinyLlama...`);
      } else {
        throw geminiError;
      }
    }
  }

  // Local AI Execution (TinyLlama-1.1B on FastAPI)
  console.log(`💻 [Central Provider: Local TinyLlama] Generating text...`);
  const localResponse = await callLocalAI(options.prompt, options.maxTokens ?? 1024);
  if (!localResponse || localResponse.trim().length === 0) {
    throw new Error('Local AI server returned an empty generation response.');
  }
  return localResponse.trim();
}

/**
 * Centralized Structured Output Generation Execution
 */
export async function executeStructuredGeneration<T>(options: {
  prompt: string;
  schema?: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  assertCapability('structured-json');
  const { provider, hasCloudKey } = getActiveProvider();

  // Try Gemini with Genkit structured output schema if available
  if (provider === 'gemini' || (provider === 'auto' && hasCloudKey)) {
    if (!hasCloudKey) {
      throw new AIProviderUnavailableError('gemini', 'GOOGLE_GENAI_API_KEY is not configured in .env.local.');
    }

    try {
      console.log(`🌐 [Central Provider: Gemini] Generating structured output...`);
      const response = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: options.prompt,
        output: options.schema ? { schema: options.schema } : undefined,
        config: {
          temperature: options.temperature ?? 0.7,
        }
      });

      const output = response.output;
      if (output) {
        return output as T;
      }
      const rawText = response.text;
      if (rawText) {
        const parsed = extractJSON(rawText);
        if (options.schema) {
          return options.schema.parse(parsed) as T;
        }
        return parsed as T;
      }
      throw new Error('Gemini returned empty structured output.');
    } catch (geminiError: any) {
      console.warn(`⚠️ [Central Provider] Gemini structured output failed: ${geminiError.message}`);
      if (provider === 'gemini') {
        throw geminiError;
      }
      console.log(`📡 [Central Provider] Falling back to local TinyLlama for structured JSON...`);
    }
  }

  // Local AI Execution (TinyLlama + extractJSON + Zod schema validation)
  console.log(`💻 [Central Provider: Local TinyLlama] Generating structured output...`);
  const rawResponse = await callLocalAI(options.prompt, options.maxTokens ?? 1500);
  const jsonParsed = extractJSON(rawResponse);
  
  if (options.schema) {
    return options.schema.parse(jsonParsed) as T;
  }
  return jsonParsed as T;
}
