"use server";
/**
 * @fileOverview A helper flow to get available TTS voices for a given language.
 */

import type { GetTtsVoicesOutput } from "./get-tts-voices.types";

const STANDARD_VOICES: GetTtsVoicesOutput = [
  { name: 'Puck', service: 'googleAI', languageCodes: ['en', 'en-US'], gender: 'MALE' },
  { name: 'Charon', service: 'googleAI', languageCodes: ['en', 'en-US'], gender: 'MALE' },
  { name: 'Kore', service: 'googleAI', languageCodes: ['en', 'en-US'], gender: 'FEMALE' },
  { name: 'Fenrir', service: 'googleAI', languageCodes: ['en', 'en-US'], gender: 'MALE' },
  { name: 'Aoede', service: 'googleAI', languageCodes: ['en', 'en-US'], gender: 'FEMALE' },
  { name: 'Algenib', service: 'googleAI', languageCodes: ['en', 'en-US', 'hi', 'hi-IN'], gender: 'NEUTRAL' },
];

export async function getTtsVoices(languageCode: string): Promise<GetTtsVoicesOutput> {
  const code = (languageCode || 'en').toLowerCase().trim();
  const matched = STANDARD_VOICES.filter(voice =>
    voice.languageCodes.some(lc => lc.toLowerCase().startsWith(code) || code.startsWith(lc.toLowerCase()))
  );
  return matched.length > 0 ? matched : STANDARD_VOICES;
}
