import { GoogleGenAI } from '@google/genai';
import { geminiBaseUrl, googleApiKey, requireEnv } from '@/lib/config';

export function createGoogleClient(overrides?: { apiKey?: string; baseUrl?: string }) {
  const config: ConstructorParameters<typeof GoogleGenAI>[0] & {
    httpOptions?: { baseUrl: string };
  } = {
    apiKey: requireEnv('GOOGLE_API_KEY', overrides?.apiKey || googleApiKey),
  };

  const resolvedBaseUrl = overrides?.baseUrl || geminiBaseUrl;
  if (resolvedBaseUrl) {
    config.httpOptions = { baseUrl: resolvedBaseUrl };
  }

  return new GoogleGenAI(config);
}
