import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CREDIT_COSTS } from '@/constants';
import { shouldUseSupabase } from '@/lib/config';
import { createGoogleClient } from '@/lib/google/client';
import { generateImageWithFlow, generateVideoWithFlow } from '@/lib/flow/flowService';

const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image';

function dedupeImages(images: Array<{ url: string; mimeType: string; base64: string }>) {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = image.base64 || image.url;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function shouldFallbackImageModel(error: unknown, imageModel: string) {
  if (imageModel !== 'gemini-3.0-pro-image') {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  return (
    normalized.includes('pro 账号') ||
    normalized.includes('pro account') ||
    normalized.includes('403') ||
    normalized.includes('forbidden')
  );
}

async function generateImageWithFallback(params: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  referenceImages?: string[];
  imageModel: string;
  cameraPrompt?: string;
  stylePrompt?: string;
}) {
  try {
    return await generateImageWithFlow({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio as any,
      resolution: params.resolution as any,
      referenceImages: params.referenceImages || [],
      imageModel: params.imageModel,
      cameraPrompt: params.cameraPrompt,
      stylePrompt: params.stylePrompt,
    });
  } catch (error) {
    if (!shouldFallbackImageModel(error, params.imageModel)) {
      throw error;
    }

    return generateImageWithFlow({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio as any,
      resolution: params.resolution as any,
      referenceImages: params.referenceImages || [],
      imageModel: FALLBACK_IMAGE_MODEL,
      cameraPrompt: params.cameraPrompt,
      stylePrompt: params.stylePrompt,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, prompt, aspectRatio, resolution, referenceImages, imageModel, cameraPrompt, stylePrompt, count } = body;
    const variantCount = Math.max(1, Math.min(4, Number(count || 1)));

    if (type !== 'image' && type !== 'audio' && type !== 'video') {
      return NextResponse.json({ error: '无效的生成类型' }, { status: 400 });
    }

    let creditsRemaining = 0;

    if (shouldUseSupabase) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
      }

      const cost =
        type === 'image'
          ? CREDIT_COSTS.IMAGE_GEN * variantCount
          : type === 'video'
            ? CREDIT_COSTS.VIDEO_GEN * variantCount
            : CREDIT_COSTS.AUDIO_GEN;
      const opType =
        type === 'image' ? 'image_gen' : type === 'video' ? 'video_gen' : 'audio_gen';
      const opDesc =
        type === 'image' ? '图片帧生成' : type === 'video' ? '分镜图生成视频' : '语音合成';

      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', {
          p_user_id: user.id,
          p_amount: cost,
          p_type: opType,
          p_description: opDesc,
        });

      if (deductError) throw deductError;
      if (!deductResult?.[0]?.success) {
        return NextResponse.json(
          { error: deductResult?.[0]?.error || '点数不足，请充值' },
          { status: 402 }
        );
      }

      creditsRemaining = deductResult[0].new_balance;
    }

    if (type === 'image') {
      const collectedImages: Array<{ url: string; mimeType: string; base64: string }> = [];
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts && collectedImages.length < variantCount; attempt += 1) {
        const remaining = variantCount - collectedImages.length;
        const batchSize = Math.min(remaining, 2);
        const results = await Promise.all(
          Array.from({ length: batchSize }, () =>
            generateImageWithFallback({
              prompt,
              aspectRatio,
              resolution,
              referenceImages: referenceImages || [],
              imageModel,
              cameraPrompt,
              stylePrompt,
            })
          )
        );

        const newImages = results.flatMap((result) =>
          (result.images || []).map((image) => ({
            url: image.url,
            mimeType: image.mimeType,
            base64: image.base64,
          }))
        );

        const merged = dedupeImages([...collectedImages, ...newImages]);
        collectedImages.length = 0;
        collectedImages.push(...merged);
      }

      const images = collectedImages.slice(0, variantCount);
      if (images.length === 0) {
        throw new Error('未生成出可用图片');
      }

      const primaryImage = images[0];
      return NextResponse.json({
        base64: primaryImage.base64,
        url: primaryImage.url,
        mimeType: primaryImage.mimeType,
        images,
        creditsRemaining,
      });
    }

    if (type === 'video') {
      const videos = await Promise.all(
        Array.from({ length: variantCount }, async () => {
          const result = await generateVideoWithFlow({
            prompt,
            aspectRatio,
            referenceImages: referenceImages || [],
            cameraPrompt,
            stylePrompt,
          });

          return {
            url: result.url,
            mimeType: result.mimeType,
            model: result.model,
          };
        })
      );

      const primaryVideo = videos[0];
      return NextResponse.json({
        url: primaryVideo.url,
        mimeType: primaryVideo.mimeType,
        model: primaryVideo.model,
        videos,
        creditsRemaining,
      });
    }

    if (type === 'audio') {
      const { generateSpeech } = await import('@/lib/gemini/geminiService');
      const genai = createGoogleClient();
      const base64Wav = await generateSpeech(genai, body.text, body.voiceName);
      return NextResponse.json({ base64: base64Wav, creditsRemaining });
    }
  } catch (error: any) {
    console.error('[API/generate] Error:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}
