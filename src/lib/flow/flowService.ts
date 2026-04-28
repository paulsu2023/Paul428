import { AspectRatio, ImageResolution } from '@/types';
import { flowApiBaseUrl, flowApiKey } from '@/lib/config';

const FLOW_IMAGE_RE = /!\[[^\]]*\]\((.*?)\)/g;
const FLOW_VIDEO_RE = /<video[^>]+src=['"](.*?)['"]/i;

const IMAGE_ASPECT_SUFFIX: Record<string, string> = {
  [AspectRatio.Ratio_9_16]: 'portrait',
  [AspectRatio.Ratio_16_9]: 'landscape',
  [AspectRatio.Ratio_1_1]: 'square',
  [AspectRatio.Ratio_4_3]: 'four-three',
  [AspectRatio.Ratio_3_4]: 'three-four',
};

function guessMimeTypeFromBase64(data: string) {
  const bytes = Buffer.from(data, 'base64');

  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function toDataUrl(base64: string) {
  const mimeType = guessMimeTypeFromBase64(base64);
  return `data:${mimeType};base64,${base64}`;
}

function extractMarkdownImageUrls(content: string) {
  return [...content.matchAll(FLOW_IMAGE_RE)]
    .map((match) => match?.[1]?.trim())
    .filter((url): url is string => Boolean(url));
}

function extractVideoUrl(content: string) {
  const match = FLOW_VIDEO_RE.exec(content);
  return match?.[1]?.trim();
}

function isUnsafeGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.toUpperCase().includes('PUBLIC_ERROR_UNSAFE_GENERATION');
}

function normalizeVideoPrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.prompt === 'string') {
      return parsed.prompt.trim();
    }
    if (parsed?.veo_production_manifest) {
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function sanitizeVideoPrompt(prompt: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bSpoken dialogue:\s*.*$/gim, ''],
    [/\btankini\b/gi, 'beach outfit'],
    [/\bswimsuit\b/gi, 'outfit'],
    [/\bone-piece\b/gi, 'summer outfit'],
    [/\bswim shorts?\b/gi, 'shorts'],
    [/\bbikini\b/gi, 'beach outfit'],
    [/\bv-neck\b/gi, 'soft neckline'],
    [/\bcriss-cross back straps?\b/gi, 'clean back detail'],
    [/\bplus-size\b/gi, 'confident'],
    [/\bupper body\b/gi, 'outfit'],
    [/\bbody\b/gi, 'appearance'],
    [/\bshowcasing the outfit\b/gi, 'presenting the look naturally'],
    [/\badjusting the straps\b/gi, 'gently turning to show the outfit'],
    [/\bturns? around\b/gi, 'makes a subtle front-facing pose adjustment'],
    [/\bturns? to show the back\b/gi, 'makes a subtle pose adjustment while staying front-facing'],
    [/\bslowly turns? to show the back.*?\b/gi, 'keeps a steady front-facing pose'],
    [/\bback-facing\b/gi, 'front-facing'],
    [/\bturn-away\b/gi, 'steady front-facing pose'],
    [/\brear view\b/gi, 'front view'],
    [/\bshow the back of the swimsuit\b/gi, 'show the back of the outfit'],
    [/\bshow the back of the beach outfit\b/gi, 'show the back of the outfit'],
    [/\bshow the back of the bikini\b/gi, 'show the back of the outfit'],
    [/\bshow the back of the tankini\b/gi, 'show the back of the outfit'],
    [/\bshow the back of the outfit\b/gi, 'maintain the same visible side of the outfit'],
    [/\brotate\b/gi, 'reposition slightly'],
    [/\bclose-up shot focusing on the .*?details\b/gi, 'close-up shot focusing on the outfit details'],
  ];

  let sanitized = prompt;
  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function looksLikeJsonPrompt(prompt: string) {
  const trimmed = prompt.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

function resolveImageModel(baseModel: string, aspectRatio: AspectRatio, resolution: ImageResolution) {
  const aspectSuffix = IMAGE_ASPECT_SUFFIX[aspectRatio] || 'portrait';

  if (baseModel === 'imagen-4.0-generate-preview') {
    const orientation = aspectSuffix === 'landscape' ? 'landscape' : 'portrait';
    return `${baseModel}-${orientation}`;
  }

  let model = `${baseModel}-${aspectSuffix}`;
  if (resolution === ImageResolution.Res_2K) {
    model += '-2k';
  } else if (resolution === ImageResolution.Res_4K) {
    model += '-4k';
  }

  return model;
}

function isPortraitAspectRatio(aspectRatio: AspectRatio) {
  return [
    AspectRatio.Ratio_9_16,
    AspectRatio.Ratio_3_4,
    AspectRatio.Ratio_1_1,
  ].includes(aspectRatio);
}

function resolveStoryboardVideoModel(aspectRatio: AspectRatio, imageCount: number) {
  const portrait = isPortraitAspectRatio(aspectRatio);

  if (imageCount >= 3) {
    return portrait ? 'veo_3_1_r2v_fast_portrait' : 'veo_3_1_r2v_fast';
  }

  return portrait ? 'veo_3_1_i2v_s_fast_portrait_fl' : 'veo_3_1_i2v_s_fast_fl';
}

async function callFlowChat(model: string, content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>) {
  const response = await fetch(`${flowApiBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${flowApiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.detail || 'Flow2API 请求失败');
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Flow2API 返回为空');
  }

  return text;
}

async function fetchAssetAsBase64(url: string) {
  if (url.startsWith('data:')) {
    const [, meta, base64] = /^data:(.*?);base64,(.*)$/.exec(url) || [];
    if (!base64) {
      throw new Error('无效的图片 data URL');
    }
    return {
      base64,
      mimeType: meta || 'image/jpeg',
    };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载 Flow 图片失败: ${response.status}`);
  }

  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    base64: buffer.toString('base64'),
    mimeType,
  };
}

async function waitForRemoteAsset(url: string, kind: 'image' | 'video', retries = 15, delayMs = 1500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: kind === 'video' ? { Range: 'bytes=0-1' } : undefined,
      });

      if (response.ok || response.status === 206) {
        return;
      }
    } catch {
      // Ignore and retry until the asset is actually ready.
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(kind === 'video' ? '视频文件尚未准备完成，请稍后重试' : '图片文件尚未准备完成，请稍后重试');
}

export async function generateImageWithFlow(params: {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  referenceImages?: string[];
  imageModel: string;
  cameraPrompt?: string;
  stylePrompt?: string;
}) {
  const model = resolveImageModel(params.imageModel, params.aspectRatio, params.resolution);
  const prompt = [
    params.prompt?.trim(),
    params.cameraPrompt?.trim(),
    params.stylePrompt?.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const content = [
    ...(params.referenceImages || [])
      .slice(0, 3)
      .map((image) => ({
        type: 'image_url',
        image_url: {
          url: toDataUrl(image),
        },
      })),
    {
      type: 'text',
      text: prompt,
    },
  ];

  const result = await callFlowChat(model, content);
  const urls = extractMarkdownImageUrls(result).slice(0, 4);
  if (urls.length === 0) {
    throw new Error('Flow2API 未返回图片地址');
  }

  await Promise.all(urls.map((url) => waitForRemoteAsset(url, 'image', 8, 800)));
  const assets = await Promise.all(urls.map((url) => fetchAssetAsBase64(url).then((asset) => ({
    url,
    ...asset,
  }))));
  const primaryAsset = assets[0];

  return {
    model,
    url: primaryAsset.url,
    base64: primaryAsset.base64,
    mimeType: primaryAsset.mimeType,
    images: assets,
  };
}

export async function generateVideoWithFlow(params: {
  prompt: string;
  aspectRatio: AspectRatio;
  referenceImages: string[];
  cameraPrompt?: string;
  stylePrompt?: string;
}) {
  const referenceImages = (params.referenceImages || []).filter(Boolean).slice(0, 3);
  if (referenceImages.length === 0) {
    throw new Error('生成视频前至少需要一张分镜图');
  }

  const model = resolveStoryboardVideoModel(params.aspectRatio, referenceImages.length);
  const basePrompt = normalizeVideoPrompt(params.prompt?.trim() || '');
  const prompt = looksLikeJsonPrompt(basePrompt)
    ? basePrompt
    : [
        basePrompt,
        params.cameraPrompt?.trim(),
        params.stylePrompt?.trim(),
      ]
        .filter(Boolean)
        .join('\n');

  const buildContent = (textPrompt: string) => [
    {
      type: 'text',
      text: textPrompt,
    },
    ...referenceImages.map((image) => ({
      type: 'image_url',
      image_url: {
        url: toDataUrl(image),
      },
    })),
  ];

  let result: string;
  try {
    result = await callFlowChat(model, buildContent(prompt));
  } catch (error) {
    const sanitizedPrompt = sanitizeVideoPrompt(basePrompt);
    if (!isUnsafeGenerationError(error) || !sanitizedPrompt || sanitizedPrompt === basePrompt) {
      throw error;
    }
    result = await callFlowChat(model, buildContent(sanitizedPrompt));
  }

  const url = extractVideoUrl(result);
  if (!url) {
    throw new Error('Flow2API 未返回视频地址');
  }

  await waitForRemoteAsset(url, 'video', 20, 1500);

  return {
    model,
    url,
    mimeType: 'video/mp4',
  };
}
