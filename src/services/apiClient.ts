import { ProductData, AspectRatio, ImageResolution, AnalysisResult, UserGeminiConfig } from '@/types';

export const analyzeProductAPI = async (
  product: ProductData,
  sceneCount: number,
  analysisModel: string,
  geminiConfig?: UserGeminiConfig
): Promise<{ result: AnalysisResult; creditsRemaining: number }> => {
  const payloadProduct = {
    ...product,
    referenceVideo: product.referenceVideo ? {
      mimeType: product.referenceVideo.mimeType,
      fileName: product.referenceVideo.fileName,
      sizeBytes: product.referenceVideo.sizeBytes,
      durationSeconds: product.referenceVideo.durationSeconds,
      width: product.referenceVideo.width,
      height: product.referenceVideo.height,
      analysisFrames: product.referenceVideo.analysisFrames,
    } : null,
  };

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: payloadProduct, sceneCount, analysisModel, geminiConfig }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to analyze product');
  return data;
};

export const validateGeminiConfigAPI = async (
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<{ ok: boolean; providerLabel: string; model: string }> => {
  const res = await fetch('/api/google/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, baseUrl, model }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to validate API config');
  return data;
};

export const generateImageAPI = async (
  prompt: string,
  aspectRatio: string,
  resolution: string,
  referenceImages: string[] = [],
  imageModel: string,
  cameraPrompt: string,
  stylePrompt: string,
  count = 4
): Promise<{
  base64: string;
  creditsRemaining: number;
  images?: Array<{ url: string; mimeType: string; base64: string }>;
}> => {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'image',
      prompt, aspectRatio, resolution, referenceImages, imageModel, cameraPrompt, stylePrompt, count
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate image');
  return data;
};

export const generateVideoAPI = async (
  prompt: string,
  aspectRatio: string,
  referenceImages: string[],
  cameraPrompt: string,
  stylePrompt: string,
  count = 4
): Promise<{
  url: string;
  model: string;
  creditsRemaining: number;
  videos?: Array<{ url: string; mimeType: string }>;
}> => {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'video',
      prompt,
      aspectRatio,
      referenceImages,
      cameraPrompt,
      stylePrompt,
      count,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate video');
  return data;
};

export const generateSpeechAPI = async (
  text: string,
  voiceName: string
): Promise<{ base64: string; creditsRemaining: number }> => {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'audio',
      text, voiceName
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate speech');
  return data;
};

export const optimizePromptAPI = async (
  currentPrompt: string,
  visualDesc: string,
  masterPrompt?: string
): Promise<string> => {
  const res = await fetch('/api/optimize-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPrompt, visualDesc, masterPrompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to optimize prompt');
  return data.optimized;
};
