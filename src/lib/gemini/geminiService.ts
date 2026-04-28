import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ProductData, AspectRatio, ImageResolution, SceneDraft } from "@/types";
import { ANALYSIS_MODELS, GEMINI_MODEL_ANALYSIS, GEMINI_MODEL_ANALYSIS_FALLBACK, GEMINI_MODEL_TTS } from "@/constants";
import { buildVeoProductionManifest } from "@/lib/flow/veoManifest";

const GEMINI_MODEL_IMAGE = 'gemini-3.1-pro-image-preview';

export const VOICE_OPTIONS = ['Kore', 'Fenrir', 'Puck', 'Charon', 'Zephyr'];

const FEMALE_VOICE_OPTIONS = ['Kore', 'Zephyr'];
const MALE_VOICE_OPTIONS = ['Fenrir', 'Puck', 'Charon'];

const VOICE_PROFILES: Record<string, string> = {
  Kore: 'Female, Young Adult (20-30s), Clear, Energetic, Professional tone.',
  Fenrir: 'Male, Adult (30-40s), Deep, Authoritative, Resonant tone.',
  Puck: 'Male, Young Adult (20s), Playful, Casual, Friendly tone.',
  Charon: 'Male, Older Adult (50s+), Gravelly, Cinematic, Serious tone.',
  Zephyr: 'Female, Young Adult (20-30s), Soft, Breathless, Calm, ASMR-style.',
};

const TARGET_MARKETS = [
  { value: 'US', label: 'United States (美国)', language: 'English', culture: 'Western, diverse American style, energetic and direct' },
  { value: 'MX', label: 'Mexico (墨西哥)', language: 'Spanish', culture: 'Mexican/Latin American ethnicity, vibrant, warm, family-oriented and social style' },
  { value: 'BR', label: 'Brazil (巴西)', language: 'Portuguese', culture: 'Brazilian ethnicity, vibrant, diverse, and energetic South American style' },
];

const IMAGE_POSITIVE_ENHANCEMENTS = [
  'raw candid photo',
  'shot on iPhone',
  'authentic amateur footage',
  'clean aesthetic home background',
  'premium interior',
  'skin texture',
  'visible pores',
  'film grain',
  'hyper-realistic TikTok UGC style',
  'natural skin detail',
  'true-to-life lighting',
  'premium commercial realism',
  'single coherent frame',
  'single-scene composition',
  'no collage layout',
  'no split-screen framing',
  'STRICT VISUAL CONSISTENCY: Follow the person\'s face, features, and the environment EXACTLY as shown in the provided reference images.',
].join(', ');

const IMAGE_NEGATIVE_PROMPT = '--no messy, clutter, dirty, trash, illustration, 3d render, plastic skin, smooth skin, airbrushed, cartoon, morphed face, bad hands, mirror, selfie, reflection in mirror, holding phone, camera in mirror, collage, split screen, diptych, triptych, storyboard layout, contact sheet, mosaic, grid layout, tiled composition, duplicated subject, multiple panels';
const REFERENCE_PRIORITY = '产品图 > 模特图 > 背景图 > 参考视频 > 用户补充创意';
const HARNESS_PROTOCOL = [
  '所有智能体必须遵守同一套约束，不得各自自由发挥。',
  '当上传了产品图时，颜色、材质、版型、五金、覆盖面积和细节以产品图为唯一事实源。',
  '当上传了模特图时，五官、脸型、发型、肤色、年龄感、身材比例必须锁定，不允许漂移。',
  '当上传了背景图时，空间类型、家具布局、装饰、透视、光线方向必须锁定，不允许擅自换景。',
  '当上传了参考视频时，只能借鉴钩子、节奏、镜头结构、口播组织方式，不得覆盖产品与人物事实。',
  '图生视频默认禁止大幅转身、背身展示、产品方向切换、背面细节重构；如果起始帧没展示到的区域，不能靠模型自由补全。',
  '若多个素材冲突，必须明确选择更高优先级素材，不得折中乱改。',
].join('\n- ');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const msg = error.message || '';
    const status = error.status || error.code;
    const shouldRetry = status === 503 || status === 500 || status === 429 ||
      msg.includes('overloaded') || msg.includes('exhausted') || msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('UNAVAILABLE') || msg.includes('high demand');
    if (retries > 0 && shouldRetry) {
      await sleep(delay);
      return withRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

function shouldTryNextAnalysisModel(error: any) {
  const msg = error?.message || '';
  const status = error?.status || error?.code;

  return status === 503 || status === 500 || status === 429 ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED');
}

function buildAnalysisModelChain(preferredModel?: string) {
  const orderedModels = ANALYSIS_MODELS.map((item) => item.value);
  const normalizedPreferred = normalizeWhitespace(preferredModel);

  if (normalizedPreferred) {
    const startIndex = orderedModels.indexOf(normalizedPreferred);
    if (startIndex >= 0) {
      return orderedModels.slice(startIndex);
    }

    return [normalizedPreferred, ...orderedModels.filter((model) => model !== normalizedPreferred)];
  }

  return [GEMINI_MODEL_ANALYSIS, GEMINI_MODEL_ANALYSIS_FALLBACK, ...orderedModels]
    .filter((model, index, list) => Boolean(model) && list.indexOf(model) === index);
}

function normalizeWhitespace(value: string | undefined | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

type GenderLock = 'female' | 'male' | 'unknown';

function inferPresentationGenderLock(product: ProductData): GenderLock {
  const haystack = normalizeWhitespace([
    product.title,
    product.description,
    product.creativeIdeas,
    product.referenceVideo?.fileName,
  ].filter(Boolean).join(' ')).toLowerCase();

  const femaleKeywords = [
    'women', "women's", 'womens', 'female', 'lady', 'ladies', 'girl', 'girls',
    'bikini', 'swimsuit', 'swimwear', 'tankini', 'monokini', 'one-piece',
    'lingerie', 'bra', 'panty', 'dress', 'skirt',
    '女士', '女款', '女式', '女性', '女生', '女孩', '小姐姐',
    '比基尼', '泳衣', '泳装', '内衣', '文胸', '内裤', '连衣裙', '裙子',
  ];

  const maleKeywords = [
    'men', "men's", 'mens', 'male', 'gentleman', 'boy', 'boys',
    'trunks', 'boxers',
    '男士', '男款', '男式', '男性', '男生', '男孩', '平角裤',
  ];

  const hasFemaleSignal = femaleKeywords.some((keyword) => haystack.includes(keyword));
  const hasMaleSignal = maleKeywords.some((keyword) => haystack.includes(keyword));

  if (hasFemaleSignal && !hasMaleSignal) return 'female';
  if (hasMaleSignal && !hasFemaleSignal) return 'male';
  return 'unknown';
}

function pickAssignedVoice(genderLock: GenderLock) {
  const candidates = genderLock === 'female'
    ? FEMALE_VOICE_OPTIONS
    : genderLock === 'male'
      ? MALE_VOICE_OPTIONS
      : VOICE_OPTIONS;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function buildFallbackImagePrompt(scene: Partial<SceneDraft>, masterReference?: string) {
  const segments = [
    normalizeWhitespace(scene.visual_en || scene.visual),
    normalizeWhitespace(scene.action_en || scene.action) ? `Action: ${normalizeWhitespace(scene.action_en || scene.action)}` : '',
    normalizeWhitespace(scene.camera_en || scene.camera) ? `Camera: ${normalizeWhitespace(scene.camera_en || scene.camera)}` : '',
    masterReference ? `Master Character Reference (must match exactly): ${normalizeWhitespace(masterReference)}` : '',
    'Single coherent frame only. No collage, no split-screen, no storyboard grid, no duplicated subject.',
    'Raw photo, 8k, highly detailed skin texture, soft lighting, film grain, shot on Sony A7R.',
    IMAGE_POSITIVE_ENHANCEMENTS,
    'No warehouses, factories, industrial shelves, cartoon style, or synthetic beauty filters.',
    IMAGE_NEGATIVE_PROMPT,
  ].filter(Boolean);

  return segments.join(' ');
}

function appendUniqueClauses(baseText: string, clauses: string[]) {
  const base = normalizeWhitespace(baseText);
  const uniqueClauses = clauses
    .map(normalizeWhitespace)
    .filter(Boolean)
    .filter((clause) => !base.toLowerCase().includes(clause.toLowerCase()));

  return [base, ...uniqueClauses].filter(Boolean).join(' ');
}

function pushUnique(target: string[], value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return;
  if (!target.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
    target.push(normalized);
  }
}

function buildAssetMatchingGuidance(product: ProductData) {
  const notes: string[] = [];
  const genderLock = inferPresentationGenderLock(product);

  if ((product.modelImages || []).length > 0) {
    notes.push('已上传模特图，后续所有分镜必须锁定同一模特的五官、脸型、发型、肤色、年龄感和身材比例，不允许换脸、换发型或身材漂移。');
  }
  if ((product.images || []).length > 0) {
    notes.push('已上传产品图，成片中的产品颜色、面料、版型、包裹范围、细节结构必须与产品图一致，不能擅自改色或改款。');
  }
  if ((product.backgroundImages || []).length > 0) {
    notes.push('已上传背景图，场景必须使用该空间，人物站位、坐姿、镜头角度、光线方向和家具遮挡都要自然合理，不能跳到其他环境。');
  }
  if ((product.images || []).length > 0 && (product.modelImages || []).length > 0) {
    notes.push('产品穿在模特身上时必须符合模特身材比例，尺码表现自然，不能出现勒痕异常、悬空、穿模、尺寸不合身或覆盖范围错误。');
  }
  if ((product.images || []).length > 0 && (product.modelImages || []).length > 0 && (product.backgroundImages || []).length > 0) {
    notes.push('需要同时确保产品、模特、背景三者高度匹配：人要像原模特，衣服要像原产品，位置要像真实在该房间里拍摄。');
  }
  if (genderLock === 'female') {
    notes.push('当前素材更适合女性出镜或女性穿着展示，绝对禁止生成男性模特拿着、试穿或展示女士商品。');
  } else if (genderLock === 'male') {
    notes.push('当前素材更适合男性出镜或男性穿着展示，绝对禁止生成女性模特拿着、试穿或展示男士商品。');
  }

  return notes.join('；') || '未上传完整参考素材时，系统仍需维持单一人物、单一产品和单一背景世界观，避免任意漂移。';
}

function buildReferenceVideoAnalysisFallback(product: ProductData) {
  if (!product.referenceVideo) {
    return '未上传参考视频，本次脚本将主要根据产品图、模特图、背景图和你的创意方向进行原创拆解。';
  }

  return '已上传参考视频，系统会从美国市场带货转化视角拆解其中的开头钩子、镜头节奏、口播结构、卖点推进顺序、产品展示方式、字幕/文案表达和收尾转化动作。';
}

function buildReferenceVideoScriptExtractionFallback(product: ProductData) {
  if (!product.referenceVideo) {
    return '未上传参考视频，因此没有可提取的原视频脚本和画面结构。';
  }

  return '系统会先提取参考视频中的镜头顺序、关键画面、核心口播/字幕表达、钩子句式、问题切入点、卖点推进和 CTA 结构，再按美国市场高转化短视频逻辑重组到当前商品上。';
}

function buildReferenceVideoRewriteFallback(product: ProductData) {
  if (!product.referenceVideo) {
    return '未上传参考视频，因此不会做视频仿写约束，系统会围绕你提供的商品事实做转化脚本。';
  }

  if (product.creativeIdeas?.trim()) {
    return '在保留参考视频节奏和转化结构的同时，结合你的额外创意方向重塑文案；但产品细节、模特呈现和背景空间仍以你上传素材为准。';
  }

  return '若没有额外说明，将优先按照参考视频的钩子、节奏、镜头推进和文案结构进行高相似度重塑，但所有产品细节必须严格改写为你上传商品的真实信息。';
}

function buildReferenceVideoStructurePlanFallback(product: ProductData) {
  if (!product.referenceVideo) {
    return '未上传参考视频，因此不需要执行参考结构保留。';
  }

  return '在保留参考视频的整体结构前提下，优先保留“开头钩子 -> 问题/痛点 -> 产品展示 -> 卖点证明 -> 转化收尾”的顺序；如果原视频有多段节奏切换，也要尽量保留同类镜头分布，但其中的产品事实、展示动作和口播内容必须替换成与当前商品完全一致的版本。';
}

function buildReferenceVideoTimingPlan(
  product: ProductData,
  requestedSceneCount: number
) {
  const durationSeconds = Number(product.referenceVideo?.durationSeconds || 0);
  if (!durationSeconds) {
    return {
      durationSeconds: 0,
      minSceneCount: 0,
      recommendedSceneCount: requestedSceneCount > 0 ? requestedSceneCount : 0,
      estimatedDurationSeconds: requestedSceneCount > 0 ? requestedSceneCount * 8 : 0,
      promptGuidance: 'No reference video timing constraint.',
      displayText: '未上传参考视频，本次分镜时长不受原视频约束。',
    };
  }

  const minSceneCount = Math.max(1, Math.floor(durationSeconds / 8));
  const recommendedSceneCount = Math.max(1, Math.ceil(durationSeconds / 8));
  const effectiveSceneCount = requestedSceneCount > 1 ? requestedSceneCount : recommendedSceneCount;
  const estimatedDurationSeconds = effectiveSceneCount * 8;
  const minDurationSeconds = minSceneCount * 8;
  const maxDurationSeconds = recommendedSceneCount * 8;
  const sceneRangeText = minSceneCount === recommendedSceneCount
    ? `${recommendedSceneCount} scenes`
    : `${minSceneCount}-${recommendedSceneCount} scenes`;
  const durationRangeText = minDurationSeconds === maxDurationSeconds
    ? `about ${maxDurationSeconds} seconds`
    : `about ${minDurationSeconds}-${maxDurationSeconds} seconds`;

  return {
    durationSeconds,
    minSceneCount,
    recommendedSceneCount: effectiveSceneCount,
    estimatedDurationSeconds,
    promptGuidance: `Reference video duration is ${durationSeconds.toFixed(2)} seconds. Because Veo 3.1 outputs about 8 seconds per shot, rebuild the script into ${sceneRangeText} (${durationRangeText}). Prefer ${recommendedSceneCount} scenes when preserving the original pacing and beat structure. Each scene should feel like one 8-second Veo segment, and the total storyboard duration should stay close to the original video.`,
    displayText: `参考视频原时长约 ${durationSeconds.toFixed(1)} 秒。按 Veo 3.1 单条约 8 秒计算，建议重塑为 ${sceneRangeText}，最终成片控制在 ${durationRangeText}；当前优先输出 ${effectiveSceneCount} 个镜头，尽量保持与原视频接近的节奏和总时长。`,
  };
}

function buildReferenceVideoHarnessCheckFallback(product: ProductData) {
  if (!product.referenceVideo) {
    return '未上传参考视频，本次无需执行参考视频结构一致性检查。';
  }

  const checks = [
    '已检查：只保留参考视频的转化结构、节奏、镜头推进和表达方式，不照搬其中与当前产品不一致的商品事实。',
    '已检查：当前脚本中的产品颜色、材质、版型、功能描述和展示动作以用户上传商品为准，而不是以参考视频中的原商品为准。',
    '已检查：如果用户上传了模特图/背景图，重塑脚本中的人物和空间将继续锁定这些素材，不允许被参考视频带偏。',
    '已检查：开头钩子、卖点推进、CTA 和镜头顺序尽量贴近参考视频，但不会把原视频里不适用于当前商品的承诺和话术直接复制。',
  ];

  return checks.join(' ');
}

function buildExecutionHarnessFallback(product: ProductData, voiceName: string, voiceProfile: string) {
  const genderLock = inferPresentationGenderLock(product);
  const clauses = [
    `执行优先级固定为：${REFERENCE_PRIORITY}。`,
    '各智能体只能在给定素材和约束内优化，不允许为了“更好看”而自行改商品、改模特、改背景。',
    `配音人设固定为 ${voiceName}，声音画像为 ${voiceProfile}，所有镜头口播必须保持同一说话人气质与能量级别。`,
    '如上传参考视频，必须先提取其脚本、关键画面、镜头结构、口播路径和 CTA，再判断哪些可保留、哪些必须改写，最后输出显式检查结论。',
  ];

  if ((product.modelImages || []).length > 0) {
    clauses.push('模特图存在时，禁止自由更换人物身份、五官、发型、身材或年龄感。');
  }
  if ((product.backgroundImages || []).length > 0) {
    clauses.push('背景图存在时，禁止自由换景、改房型、改家具布局、改光位。');
  }
  if (product.referenceVideo) {
    clauses.push('参考视频只允许作为“表达方式参考”，不允许把其中与当前产品不一致的卖点、颜色、结构、承诺直接照搬。');
  }
  if (genderLock === 'female') {
    clauses.push('当前素材已锁定为女性展示逻辑，禁止男模特、男性持衣展示、男性试穿、男性解说式拿货展示。');
  } else if (genderLock === 'male') {
    clauses.push('当前素材已锁定为男性展示逻辑，禁止女模特、女性持衣展示、女性试穿、女性解说式拿货展示。');
  }

  return clauses.join(' ');
}

function buildTikTokPublishFallback(
  product: ProductData,
  market: { value: string; language: string }
) {
  const rawTitle = normalizeWhitespace(product.title) || '产品';
  const titleKeyword = rawTitle
    .replace(/[^\p{L}\p{N}\s#-]+/gu, ' ')
    .trim();
  const descriptionSeed = normalizeWhitespace(product.description || product.creativeIdeas);
  const keyword = titleKeyword.split(/\s+/).slice(0, 4).join(' ').trim() || 'product';
  const baseTag = `#${keyword.replace(/\s+/g, '').replace(/#/g, '')}` || '#tiktokmademebuyit';

  const primaryHashtags = [
    baseTag,
    '#tiktokmademebuyit',
    '#amazonfinds',
    '#summermusthave',
    '#ugccreator',
  ];

  const backupHashtags = [
    '#swimwear',
    '#bikini',
    '#beachwear',
    '#vacationoutfit',
    '#viralfinds',
    '#fyp',
    '#foryou',
    '#productreview',
  ];

  const isEnglish = market.language === 'English';
  const isSpanish = market.language === 'Spanish';
  const isPortuguese = market.language === 'Portuguese';

  const publishTitle = isEnglish
    ? `${rawTitle} looks even better on body than I expected`
    : isSpanish
      ? `${rawTitle} se ve mucho mejor puesto de lo que esperaba`
      : isPortuguese
        ? `${rawTitle} veste melhor do que eu imaginava`
        : `${rawTitle} looks even better on body than I expected`;

  const publishDescription = isEnglish
    ? `${rawTitle} is the kind of find that makes people stop scrolling. ${descriptionSeed ? `Key selling points: ${descriptionSeed}.` : 'Lead with a strong hook, show the real details, and explain why it is worth buying.'} Drop a comment if you want sizing, fit, or styling details.`
    : isSpanish
      ? `${rawTitle} es de esos productos que hacen que la gente deje de hacer scroll. ${descriptionSeed ? `Puntos clave: ${descriptionSeed}.` : 'Primero engancha, luego muestra los detalles reales y explica por qué vale la pena comprarlo.'} Deja un comentario si quieres más detalles de talla, ajuste o estilo.`
      : isPortuguese
        ? `${rawTitle} e daqueles produtos que fazem as pessoas pararem de rolar. ${descriptionSeed ? `Pontos principais: ${descriptionSeed}.` : 'Comece com um hook forte, mostre os detalhes reais e explique por que vale a compra.'} Comente se quiser mais detalhes de tamanho, caimento ou estilo.`
        : `${rawTitle} is the kind of find that makes people stop scrolling. ${descriptionSeed ? `Key selling points: ${descriptionSeed}.` : 'Lead with a strong hook, show the real details, and explain why it is worth buying.'} Drop a comment if you want sizing, fit, or styling details.`;

  return {
    publishTitle,
    publishDescription,
    primaryHashtags,
    backupHashtags,
  };
}

function buildReferenceLockClauses(product: ProductData, voiceName: string, voiceProfile: string) {
  const genderLock = inferPresentationGenderLock(product);
  const imageClauses: string[] = [
    `Hard constraint priority: ${REFERENCE_PRIORITY}.`,
    `Maintain the same speaker persona across all scenes: ${voiceName}, ${voiceProfile}.`,
    'Do not improvise beyond the uploaded references and explicit user instructions.',
  ];

  const videoPositiveMandates: string[] = [
    `Hard constraint priority: ${REFERENCE_PRIORITY}.`,
    `Maintain the same speaker identity, vocal timbre, age impression, and delivery energy established for ${voiceName} (${voiceProfile}) across the full storyboard.`,
  ];

  const videoNegativeMandates: string[] = [
    'NO arbitrary creative drift beyond uploaded references and approved user direction.',
    'NO unsupported product claims copied from the reference video.',
    'NO full turn-away from camera, NO back-facing reveal, NO large body rotation that changes the visible product side.',
    'NO invented rear details, NO unsupported back view, NO garment orientation swap, NO hidden-detail reconstruction.',
  ];

  if ((product.images || []).length > 0) {
    const clause = 'The product must match the uploaded product references exactly in color, silhouette, fabric, trim, coverage, logo placement, and styling details.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
    videoNegativeMandates.push('NO product recoloring, NO silhouette changes, NO invented product details.');
  }

  if ((product.modelImages || []).length > 0) {
    const clause = 'The on-screen person must match the uploaded model references exactly in face shape, eyes, nose, lips, hairstyle, skin tone, age impression, and body proportions.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
    videoNegativeMandates.push('NO face drift, NO hairstyle drift, NO body-shape drift, NO age drift.');
  }

  if ((product.backgroundImages || []).length > 0) {
    const clause = 'Use the uploaded background as the exact environment, preserving room layout, decor, furniture placement, wall colors, perspective, and lighting direction.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
    videoNegativeMandates.push('NO background swaps, NO room-type changes, NO impossible subject placement.');
  }

  if ((product.images || []).length > 0 && (product.modelImages || []).length > 0) {
    const clause = 'The product fit must match the model body naturally with accurate sizing, drape, stretch, support, and coverage. No clipping, no floating fabric, no impossible fit.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
  }

  if ((product.images || []).length > 0) {
    videoPositiveMandates.push('Keep the subject primarily front-facing or in a stable three-quarter angle. Preserve the visible product side from the start frame.');
  }

  if ((product.backgroundImages || []).length > 0 && ((product.images || []).length > 0 || (product.modelImages || []).length > 0)) {
    const clause = 'Place the model and product naturally inside the uploaded background with grounded contact, realistic scale, coherent shadows, and physically plausible positioning.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
  }

  if (product.referenceVideo) {
    const clause = 'Borrow only pacing, hook structure, shot rhythm, and conversion logic from the reference video. Rewrite all product-specific details to match the uploaded product exactly.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
    videoNegativeMandates.push('NO copying conflicting wardrobe, room, or product facts from the reference video.');
  }

  if (genderLock === 'female') {
    const clause = 'The presenter and wearer must remain female across all scenes. Keep a female model wearing or demonstrating the women’s product naturally on-body, never a male presenter holding or modeling it.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
    videoNegativeMandates.push('NO male presenter, NO male model, NO male hand-held product demo for women’s apparel, NO gender mismatch with the uploaded references.');
  } else if (genderLock === 'male') {
    const clause = 'The presenter and wearer must remain male across all scenes. Keep a male model wearing or demonstrating the men’s product naturally on-body, never a female presenter holding or modeling it.';
    imageClauses.push(clause);
    videoPositiveMandates.push(clause);
    videoNegativeMandates.push('NO female presenter, NO female model, NO female hand-held product demo for men’s apparel, NO gender mismatch with the uploaded references.');
  }

  return { imageClauses, videoPositiveMandates, videoNegativeMandates };
}

function enforceVideoPromptHarness(videoPrompt: string, positiveMandates: string[], negativeMandates: string[]) {
  const prompt = normalizeWhitespace(videoPrompt);
  if (!prompt) return prompt;

  try {
    const parsed = JSON.parse(prompt);
    const manifest = parsed?.veo_production_manifest;
    if (!manifest) return prompt;

    manifest.director_mandates = manifest.director_mandates || {};
    const positive = Array.isArray(manifest.director_mandates.positive_mandates)
      ? manifest.director_mandates.positive_mandates
      : [];
    const negative = Array.isArray(manifest.director_mandates.negative_mandates)
      ? manifest.director_mandates.negative_mandates
      : [];

    positiveMandates.forEach((mandate) => pushUnique(positive, mandate));
    negativeMandates.forEach((mandate) => pushUnique(negative, mandate));

    manifest.director_mandates.positive_mandates = positive;
    manifest.director_mandates.negative_mandates = negative;

    return JSON.stringify(parsed, null, 2);
  } catch {
    return appendUniqueClauses(prompt, [...positiveMandates, ...negativeMandates]);
  }
}

function enforceSceneGenderLock(scene: any, genderLock: GenderLock) {
  if (genderLock === 'unknown') return scene;

  const zhLead = genderLock === 'female'
    ? '同一位女性模特'
    : '同一位男性模特';
  const enLead = genderLock === 'female'
    ? 'The same female model'
    : 'The same male model';

  const withPrefix = (text: string, prefix: string) => {
    const value = normalizeWhitespace(text);
    if (!value) return value;
    if (value.toLowerCase().includes(prefix.toLowerCase())) return value;
    return `${prefix}，${value}`;
  };

  return {
    ...scene,
    visual: withPrefix(scene?.visual, zhLead),
    visual_en: withPrefix(scene?.visual_en || scene?.visual, enLead),
    action: withPrefix(scene?.action, zhLead),
    action_en: withPrefix(scene?.action_en || scene?.action, enLead),
  };
}

function containsChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function looksLikeEnglishDisplayText(text: string) {
  const value = normalizeWhitespace(text);
  if (!value) return false;
  return /[A-Za-z]{3,}/.test(value) && !containsChinese(value);
}

function normalizeHashtag(tag: string) {
  const value = normalizeWhitespace(tag).replace(/\s+/g, '');
  if (!value) return '';
  return value.startsWith('#') ? value : `#${value}`;
}

function buildPrimaryHashtagSet(primary: unknown, backup: unknown, fallback: string[]) {
  const combined = [
    ...(Array.isArray(primary) ? primary : []),
    ...(Array.isArray(backup) ? backup : []),
    ...fallback,
  ]
    .map((tag) => normalizeHashtag(String(tag || '')))
    .filter(Boolean);

  const unique: string[] = [];
  for (const tag of combined) {
    if (!unique.includes(tag)) {
      unique.push(tag);
    }
    if (unique.length >= 5) break;
  }
  return unique;
}

function buildBackupHashtagSet(primary: string[], backup: unknown, fallback: string[]) {
  const combined = [
    ...(Array.isArray(backup) ? backup : []),
    ...fallback,
  ]
    .map((tag) => normalizeHashtag(String(tag || '')))
    .filter(Boolean);

  const unique: string[] = [];
  for (const tag of combined) {
    if (!primary.includes(tag) && !unique.includes(tag)) {
      unique.push(tag);
    }
    if (unique.length >= 10) break;
  }
  return unique;
}

function needsChineseLocalization(result: any) {
  const topLevelFields = [
    result?.productType,
    result?.productSpecs,
    result?.sellingPoints,
    result?.targetAudience,
    result?.hook,
    result?.painPoints,
    result?.strategy,
    result?.modelRequirements,
    result?.backgroundGuidance,
    result?.realismGuidance,
    result?.referenceVideoTimingPlan,
    result?.complianceCheck?.report,
    result?.complianceCheck?.culturalNotes,
  ];

  if (topLevelFields.some(looksLikeEnglishDisplayText)) {
    return true;
  }

  return Array.isArray(result?.scenes) && result.scenes.some((scene: any) => (
    looksLikeEnglishDisplayText(scene?.title) ||
    looksLikeEnglishDisplayText(scene?.objective) ||
    looksLikeEnglishDisplayText(scene?.visual) ||
    looksLikeEnglishDisplayText(scene?.action) ||
    looksLikeEnglishDisplayText(scene?.camera) ||
    looksLikeEnglishDisplayText(scene?.dialogue_cn)
  ));
}

async function localizeDisplayFieldsToChinese(client: GoogleGenAI, result: any) {
  const payload = {
    productType: result.productType,
    productSpecs: result.productSpecs,
    sellingPoints: result.sellingPoints,
    targetAudience: result.targetAudience,
    hook: result.hook,
    painPoints: result.painPoints,
    strategy: result.strategy,
    modelRequirements: result.modelRequirements,
    backgroundGuidance: result.backgroundGuidance,
    realismGuidance: result.realismGuidance,
    assetMatchingGuidance: result.assetMatchingGuidance,
    referenceVideoAnalysis: result.referenceVideoAnalysis,
    referenceVideoRewrite: result.referenceVideoRewrite,
    referenceVideoTimingPlan: result.referenceVideoTimingPlan,
    executionHarness: result.executionHarness,
    complianceCheck: {
      report: result.complianceCheck?.report,
      culturalNotes: result.complianceCheck?.culturalNotes,
    },
    scenes: (result.scenes || []).map((scene: any) => ({
      title: scene?.title,
      objective: scene?.objective,
      visual: scene?.visual,
      action: scene?.action,
      camera: scene?.camera,
      dialogue_cn: scene?.dialogue_cn,
    })),
  };

  const translationModels = buildAnalysisModelChain();

  let response: GenerateContentResponse | null = null;
  let lastError: any;

  for (const model of translationModels) {
    try {
      response = await withRetry(() => client.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [{
            text: `请把下面 JSON 中所有“给中国用户前端界面展示”的字段改写成自然、简洁、专业的中文。只翻译展示字段，不要扩写，不要改动结构，不要输出 Markdown。\n\n${JSON.stringify(payload)}`,
          }],
        }],
        config: {
          systemInstruction: '你是一个中文本地化编辑。你的任务是把输入 JSON 中面向中国用户展示的字段统一改写为自然中文。保留 JSON 结构不变。不要输出英文整句。不要新增字段。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productType: { type: Type.STRING },
              productSpecs: { type: Type.STRING },
              sellingPoints: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              hook: { type: Type.STRING },
              painPoints: { type: Type.STRING },
              strategy: { type: Type.STRING },
              modelRequirements: { type: Type.STRING },
              backgroundGuidance: { type: Type.STRING },
              realismGuidance: { type: Type.STRING },
              assetMatchingGuidance: { type: Type.STRING },
              referenceVideoAnalysis: { type: Type.STRING },
              referenceVideoScriptExtraction: { type: Type.STRING },
              referenceVideoRewrite: { type: Type.STRING },
              referenceVideoStructurePlan: { type: Type.STRING },
              referenceVideoTimingPlan: { type: Type.STRING },
              referenceVideoHarnessCheck: { type: Type.STRING },
              executionHarness: { type: Type.STRING },
              complianceCheck: {
                type: Type.OBJECT,
                properties: {
                  report: { type: Type.STRING },
                  culturalNotes: { type: Type.STRING },
                },
                required: ['report', 'culturalNotes'],
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    objective: { type: Type.STRING },
                    visual: { type: Type.STRING },
                    action: { type: Type.STRING },
                    camera: { type: Type.STRING },
                    dialogue_cn: { type: Type.STRING },
                  },
                  required: ['title', 'objective', 'visual', 'action', 'camera', 'dialogue_cn'],
                },
              },
            },
            required: [
              'productType',
              'productSpecs',
              'sellingPoints',
              'targetAudience',
              'hook',
              'painPoints',
              'strategy',
              'modelRequirements',
              'backgroundGuidance',
              'realismGuidance',
              'assetMatchingGuidance',
              'referenceVideoAnalysis',
              'referenceVideoScriptExtraction',
              'referenceVideoRewrite',
              'referenceVideoStructurePlan',
              'referenceVideoTimingPlan',
              'referenceVideoHarnessCheck',
              'executionHarness',
              'complianceCheck',
              'scenes',
            ],
          },
        },
      }));
      break;
    } catch (error: any) {
      lastError = error;
      if (!shouldTryNextAnalysisModel(error)) {
        break;
      }
    }
  }

  if (!response?.text) {
    if (lastError) {
      console.warn('[GeminiService] 中文本地化兜底失败:', lastError);
    }
    return result;
  }

  const localized = JSON.parse(
    response.text.replace(/```json\s*/g, '').replace(/```/g, '').trim()
  );

  return {
    ...result,
    productType: localized.productType || result.productType,
    productSpecs: localized.productSpecs || result.productSpecs,
    sellingPoints: localized.sellingPoints || result.sellingPoints,
    targetAudience: localized.targetAudience || result.targetAudience,
    hook: localized.hook || result.hook,
    painPoints: localized.painPoints || result.painPoints,
    strategy: localized.strategy || result.strategy,
    modelRequirements: localized.modelRequirements || result.modelRequirements,
    backgroundGuidance: localized.backgroundGuidance || result.backgroundGuidance,
    realismGuidance: localized.realismGuidance || result.realismGuidance,
    assetMatchingGuidance: localized.assetMatchingGuidance || result.assetMatchingGuidance,
    referenceVideoAnalysis: localized.referenceVideoAnalysis || result.referenceVideoAnalysis,
    referenceVideoScriptExtraction: localized.referenceVideoScriptExtraction || result.referenceVideoScriptExtraction,
    referenceVideoRewrite: localized.referenceVideoRewrite || result.referenceVideoRewrite,
    referenceVideoStructurePlan: localized.referenceVideoStructurePlan || result.referenceVideoStructurePlan,
    referenceVideoTimingPlan: localized.referenceVideoTimingPlan || result.referenceVideoTimingPlan,
    referenceVideoHarnessCheck: localized.referenceVideoHarnessCheck || result.referenceVideoHarnessCheck,
    executionHarness: localized.executionHarness || result.executionHarness,
    complianceCheck: {
      ...result.complianceCheck,
      report: localized.complianceCheck?.report || result.complianceCheck?.report,
      culturalNotes: localized.complianceCheck?.culturalNotes || result.complianceCheck?.culturalNotes,
    },
    scenes: (result.scenes || []).map((scene: any, index: number) => ({
      ...scene,
      title: localized.scenes?.[index]?.title || scene.title,
      objective: localized.scenes?.[index]?.objective || scene.objective,
      visual: localized.scenes?.[index]?.visual || scene.visual,
      action: localized.scenes?.[index]?.action || scene.action,
      camera: localized.scenes?.[index]?.camera || scene.camera,
      dialogue_cn: localized.scenes?.[index]?.dialogue_cn || scene.dialogue_cn,
    })),
  };
}

function normalizeScene(scene: any, index: number, masterReference?: string): SceneDraft {
  const promptText = normalizeWhitespace(scene?.prompt?.textPrompt) ||
    buildFallbackImagePrompt(scene, masterReference);
  const videoPrompt = normalizeWhitespace(scene?.prompt?.videoPrompt || scene?.prompt?.imagePrompt) ||
    buildVeoProductionManifest(scene);

  return {
    id: String(scene?.id || `scene-${index + 1}`),
    title: normalizeWhitespace(scene?.title || `分镜 ${index + 1}`),
    objective: normalizeWhitespace(scene?.objective),
    visual: normalizeWhitespace(scene?.visual),
    visual_en: normalizeWhitespace(scene?.visual_en || scene?.visual),
    action: normalizeWhitespace(scene?.action),
    action_en: normalizeWhitespace(scene?.action_en || scene?.action),
    camera: normalizeWhitespace(scene?.camera),
    camera_en: normalizeWhitespace(scene?.camera_en || scene?.camera),
    dialogue: normalizeWhitespace(scene?.dialogue),
    dialogue_cn: normalizeWhitespace(scene?.dialogue_cn),
    prompt: {
      textPrompt: promptText,
      imagePrompt: videoPrompt,
      videoPrompt,
      videoPromptCustom: true,
    },
  };
}

// Fixed WAV encoder (CRITICAL BUG fix from original)
const pcmToWav = (base64PCM: string, sampleRate = 24000): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  const writeString = (v: DataView, offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, len, true);

  const headerBytes = new Uint8Array(wavHeader);
  const wavBytes = new Uint8Array(headerBytes.length + bytes.length);
  wavBytes.set(headerBytes);
  wavBytes.set(bytes, headerBytes.length);

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < wavBytes.length; i += chunkSize) {
    const chunk = wavBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const analyzeProduct = async (
  client: GoogleGenAI,
  product: ProductData,
  sceneCount: number,
  preferredModel?: string
): Promise<any> => {
  const genderLock = inferPresentationGenderLock(product);
  const assignedVoice = pickAssignedVoice(genderLock);
  const voiceProfile = VOICE_PROFILES[assignedVoice] || 'Standard Voice';
  const defaultMarket = TARGET_MARKETS.find(m => m.value === 'US') || TARGET_MARKETS[0];
  const market = TARGET_MARKETS.find(m => m.value === product.targetMarket) || defaultMarket;
  const referenceHarness = buildReferenceLockClauses(product, assignedVoice, voiceProfile);
  const timingPlan = buildReferenceVideoTimingPlan(product, sceneCount);
  const effectiveSceneCount = product.referenceVideo
    ? timingPlan.recommendedSceneCount || sceneCount || 1
    : (sceneCount > 0 ? sceneCount : 1);

  const creativeInstruction = product.creativeIdeas?.trim()
    ? `User Creative Direction: ${product.creativeIdeas.trim()}`
    : 'No specific user creative direction provided. Use expert judgment to create the best converting content.';

  const systemInstruction = `
 你是一个由 7 位专家组成的顶级 TikTok 电商创意团队，服务于 ${market.label} 市场。

专家角色：
1. 产品分析师：识别产品规格、材质、使用场景、功能与限制。
 2. TikTok 电商专家：理解 ${market.label} 市场用户、平台语境、带货钩子和 UGC 转化逻辑。
3. 营销大师：挖掘痛点、卖点、购买动机、反对点与强 Hook。
4. 品牌专家：确保语气统一、内容高级、不低质、不廉价。
5. 导演大师 + Veo 3.1 Prompt Engineer：负责分镜、运镜、文生图 prompt、图生视频 JSON manifest。
6. TikTok 合规专员：检查 ${market.label} 市场文化和 TikTok 广告风险。
7. Reference Harness 工程师：负责锁定素材优先级、禁止随意发挥、确保所有智能体严格执行同一套约束。
你必须始终站在“美国 TikTok 电商营销专家”的视角处理参考视频：不仅要看画面，还要拆解它为什么能转化、针对的用户情绪是什么、问题是怎么被放大的、卖点是如何被证明的、CTA 为什么会成立。

硬性规则：
- 目标市场默认按 ${market.label} 处理，文化审美必须符合 ${market.culture}。
- Voice dictates visuals：配音角色是 ${assignedVoice}，声音画像是 ${voiceProfile}。Scene 1 的人物必须是声音的物理化身。
- Scene 1 必须定义明确模特：年龄、性别、种族/文化特征、发型、穿搭、气质。
- 人物性别必须与商品类型、模特图、参考视频主体一致。女士商品/女性参考视频/女性模特素材只能输出女性模特；男士商品/男性参考视频/男性模特素材只能输出男性模特。
- 若参考视频展示的是“女性穿着女士泳衣/女士服饰”，必须保留同样的女性穿着展示逻辑，绝对禁止出现男性拿着女士商品、男性试穿女士商品、男性讲解式手持展示女士商品。
- Scene 2+ 必须沿用 Scene 1 的同一人物与同一背景世界观。
- 素材优先级固定为：${REFERENCE_PRIORITY}。
- 如果上传了产品图，产品图是商品事实唯一真源；如果上传了模特图，模特图是人物身份唯一真源；如果上传了背景图，背景图是空间场景唯一真源。
- 如果上传了产品图 + 模特图 + 背景图，必须做“强匹配”：模特保持同一人，穿着与产品图一致的商品，尺码/松紧/覆盖范围与该模特身材相符，并自然地处于该背景空间中。
- 当模特、产品、背景同时存在时，必须显式检查：脸和发型一致、身材比例一致、产品尺码和上身效果合理、房间里的站位/坐姿/遮挡/透视/光线合理。
- 如果用户上传背景图，必须优先使用。
- 如果用户没有背景图，必须选择一个唯一且高格调、生活化、适合 TikTok UGC 的背景，并在所有 scenes 保持一致。
- 除非用户明确要求，否则绝对禁止工厂、仓库、杂乱货架、低质工业环境。
- 如果上传了参考视频，必须先提取它的脚本和画面结构：包括开头钩子、每段镜头要点、字幕/文案表达、口播逻辑、卖点推进、CTA、画面切换方式和节奏节点。
- 如果上传了参考视频，必须从美国市场营销角度判断：原视频究竟在卖什么情绪、切中了什么痛点、用了什么说服路径、为什么能促成转化。
- 如果用户没有额外说明，则在参考视频结构的基础上进行高相似度重塑，但产品细节、颜色、材质、版型、模特、背景、尺码表现必须以用户上传素材为准。
- 如果参考视频中的商品细节与用户上传商品冲突，必须舍弃参考视频中的商品事实，只保留其节奏和表达方式。
- 你必须明确写出“哪些结构被保留、哪些内容被替换、替换理由是什么”，不能只笼统说“参考了视频结构”。
- 你必须输出一段 referenceVideoHarnessCheck，说明本次是否已经检查过：结构保留、产品事实替换、人物/背景锁定、卖点贴合、CTA 贴合。
- 如果上传了参考视频，必须根据参考视频总时长来规划分镜数量和总片长，尽量把最终脚本重塑到与原视频接近的时长区间；Veo 3.1 每条视频约 8 秒，因此需要按 8 秒一镜来拆分。
- 图像生成 prompt 要为高真实度 Banana/Gemini 生图优化：真实皮肤、真实布料、真实光线、真实手机拍摄质感、避免 AI 塑料感。
- 视频生成 prompt 必须是严格 JSON 字符串，深刻理解 Veo 3.1：避免 flicker、morph、曝光跳变、材质爬行、不合物理规律的动作。
- 所有 scenes 的配音人设必须保持一致，不允许镜头之间出现声音年龄、性别、语气、能量级别漂移。
- 图生视频默认禁止模特大幅转身、背身展示、转到背面后再回正；禁止因为转身导致人物换脸、发型漂移或产品背面细节被模型随意补全。
- 如果起始帧只展示了正面或侧前方，就必须保持同一可见方向，不允许切换产品方向或暴露未被参考图证明过的背面结构。
- 视频 JSON manifest 内所有内容必须英文，且必须包含 start frame consistency mandates。
- 分析报告字段必须中文输出。
- 分镜展示字段 title/objective/visual/action/camera/dialogue_cn 必须中文，不能输出英文整句。
- visual_en/action_en/camera_en、图像 prompt、视频 JSON manifest 必须英文。
- dialogue 必须使用地道 ${market.language}。
- publishTitle、publishDescription 和 hashtags 必须使用 ${market.language} 或该市场常用 TikTok 发布语言，不允许被翻成中文，除非目标市场本身是中文市场。
- 开头 3 秒必须有强烈视觉或语言钩子。
- 你必须额外输出一个 TikTok 发布包：包含 1 条强钩子发布标题、1 条引流型发布描述、5 个最推荐标签、5-10 个备选标签。
- 标签必须与产品高度相关，同时尽量兼顾 TikTok 的流量曝光；不能全是泛标签，也不能全是超垂类小标签。
- 如果用户填写了产品标题、产品描述或卖点诉求，发布标题、发布描述和标签必须优先关联这些信息。
- 你必须输出一段中文 executionHarness，总结本次执行约束；这段约束不是建议，而是所有 agent 必须遵守的硬规则。

Harness Protocol:
- ${HARNESS_PROTOCOL}

图像 prompt 附加要求：
- 必须内置高真实度方向：${IMAGE_POSITIVE_ENHANCEMENTS}
- 必须内置负面约束：${IMAGE_NEGATIVE_PROMPT}
- 单张图必须是单一完整画面，禁止拼图感、分屏、多宫格、海报拼贴、故事板排版、重复主体。

视频 JSON manifest 规则：
- 输出字段 prompt.videoPrompt 时，必须返回原始 JSON 字符串。
- 必须遵循 veo_production_manifest v4.0 思路。
- 必须包含：
  - "The video MUST start with the provided start frame."
  - "Maintenance of texture, lighting, and resolution from the start frame is critical."
  - "Maintain the same speaker identity, vocal timbre, age impression, and delivery energy across the full storyboard."
  - "Keep the subject primarily front-facing or in a stable three-quarter angle. Preserve the visible product side from the start frame."
  - consistency_check: "At 0s, 2s, 4s, 6s: Ensure absolute consistency in lighting, resolution, and character appearance with the start frame. Do not lower resolution."
- 必须加入 no flicker / no morphing / no resolution drop / no mirrors / no impossible physics / no turn-away / no unsupported back reveal / no product orientation swap。
`;

  const parts: any[] = [];
  [...(product.images || []), ...(product.modelImages || []), ...(product.backgroundImages || [])].forEach(base64 => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
  });
  if (product.referenceVideo?.analysisFrames?.length) {
    product.referenceVideo.analysisFrames.slice(0, 4).forEach((frame) => {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: frame } });
    });
  }

  const promptText = `
Target market: ${market.label}
Target language for dialogue: ${market.language}
Target cultural style: ${market.culture}
Product title: ${product.title || 'Not specified'}
Product description: ${product.description || 'Not specified'}
Requested scene count: ${effectiveSceneCount > 0 ? effectiveSceneCount : 'Auto (3-8 scenes)'}
Reference model images supplied: ${(product.modelImages || []).length}
Reference background images supplied: ${(product.backgroundImages || []).length}
Reference product images supplied: ${(product.images || []).length}
Reference video supplied: ${product.referenceVideo ? 'Yes' : 'No'}
Reference video metadata: ${product.referenceVideo ? `${product.referenceVideo.fileName || 'unknown'}, ${product.referenceVideo.durationSeconds || 0}s, ${product.referenceVideo.width || 0}x${product.referenceVideo.height || 0}, frames=${product.referenceVideo.analysisFrames?.length || 0}` : 'None'}
Presentation gender lock: ${genderLock}
Reference video timing rebuild plan: ${timingPlan.promptGuidance}
${creativeInstruction}

Return a high-conversion TikTok storyboard package with deep product analysis, customer pain points, target customer, ideal model guidance, background guidance, realism guidance, asset matching guidance, reference video analysis, extracted reference script/visual structure, reference-video-based rewrite strategy, retained structure plan, reference video timing plan, reference video harness checks, execution harness, and per-scene image/video prompts.
`;
  parts.push({ text: promptText });

  const generationConfig: any = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        productType: { type: Type.STRING },
        productSpecs: { type: Type.STRING },
        sellingPoints: { type: Type.STRING },
        targetAudience: { type: Type.STRING },
        hook: { type: Type.STRING },
        painPoints: { type: Type.STRING },
        strategy: { type: Type.STRING },
        modelRequirements: { type: Type.STRING },
        backgroundGuidance: { type: Type.STRING },
        realismGuidance: { type: Type.STRING },
        assetMatchingGuidance: { type: Type.STRING },
        referenceVideoAnalysis: { type: Type.STRING },
        referenceVideoScriptExtraction: { type: Type.STRING },
        referenceVideoRewrite: { type: Type.STRING },
        referenceVideoStructurePlan: { type: Type.STRING },
        referenceVideoTimingPlan: { type: Type.STRING },
        referenceVideoHarnessCheck: { type: Type.STRING },
        recommendedSceneCount: { type: Type.NUMBER },
        estimatedDurationSeconds: { type: Type.NUMBER },
        publishTitle: { type: Type.STRING },
        publishDescription: { type: Type.STRING },
        primaryHashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        backupHashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        executionHarness: { type: Type.STRING },
        assignedVoice: { type: Type.STRING },
        complianceCheck: {
          type: Type.OBJECT,
          properties: {
            isCompliant: { type: Type.BOOLEAN },
            riskLevel: { type: Type.STRING, enum: ['Safe', 'Warning', 'High Risk'] },
            report: { type: Type.STRING },
            culturalNotes: { type: Type.STRING },
          },
          required: ['isCompliant', 'riskLevel', 'report', 'culturalNotes'],
        },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              objective: { type: Type.STRING },
              visual: { type: Type.STRING },
              visual_en: { type: Type.STRING },
              action: { type: Type.STRING },
              action_en: { type: Type.STRING },
              camera: { type: Type.STRING },
              camera_en: { type: Type.STRING },
              dialogue: { type: Type.STRING },
              dialogue_cn: { type: Type.STRING },
              prompt: {
                type: Type.OBJECT,
                properties: {
                  textPrompt: { type: Type.STRING },
                  videoPrompt: { type: Type.STRING },
                },
                required: ['textPrompt', 'videoPrompt'],
              },
            },
            required: [
              'id',
              'title',
              'objective',
              'visual',
              'visual_en',
              'action',
              'action_en',
              'camera',
              'camera_en',
              'dialogue',
              'dialogue_cn',
              'prompt',
            ],
          },
        },
      },
      required: [
        'productType',
        'productSpecs',
        'sellingPoints',
        'targetAudience',
        'hook',
        'painPoints',
        'strategy',
        'modelRequirements',
        'backgroundGuidance',
        'realismGuidance',
        'assetMatchingGuidance',
        'referenceVideoAnalysis',
        'referenceVideoScriptExtraction',
        'referenceVideoRewrite',
        'referenceVideoStructurePlan',
        'referenceVideoTimingPlan',
        'referenceVideoHarnessCheck',
        'publishTitle',
        'publishDescription',
        'primaryHashtags',
        'backupHashtags',
        'executionHarness',
        'complianceCheck',
        'scenes',
      ],
    },
  };

  const analysisModels = buildAnalysisModelChain(preferredModel);

  let response: GenerateContentResponse | null = null;
  let lastError: any;

  for (const model of analysisModels) {
    try {
      response = await withRetry(() => client.models.generateContent({
        model,
        contents: { parts },
        config: generationConfig,
      }));
      break;
    } catch (error: any) {
      lastError = error;
      if (!shouldTryNextAnalysisModel(error)) {
        throw error;
      }
    }
  }

  if (!response) {
    throw lastError || new Error('分析模型调用失败');
  }

  const jsonText = (response.text || '{}').replace(/```json\s*/g, '').replace(/```/g, '').trim();
  let result = JSON.parse(jsonText);
  if (!result.scenes || !Array.isArray(result.scenes)) {
    throw new Error('AI response invalid: missing scenes');
  }

  if (needsChineseLocalization(result)) {
    result = await localizeDisplayFieldsToChinese(client, result);
  }

  const masterReference = result.scenes?.[0]?.visual_en || result.modelRequirements || '';

  result.assignedVoice = assignedVoice;
  result.productSpecs = normalizeWhitespace(result.productSpecs);
  result.modelRequirements = normalizeWhitespace(result.modelRequirements);
  result.backgroundGuidance = normalizeWhitespace(result.backgroundGuidance);
  result.realismGuidance = normalizeWhitespace(result.realismGuidance);
  result.assetMatchingGuidance = normalizeWhitespace(result.assetMatchingGuidance) || buildAssetMatchingGuidance(product);
  result.referenceVideoAnalysis = normalizeWhitespace(result.referenceVideoAnalysis) || buildReferenceVideoAnalysisFallback(product);
  result.referenceVideoScriptExtraction = normalizeWhitespace(result.referenceVideoScriptExtraction) || buildReferenceVideoScriptExtractionFallback(product);
  result.referenceVideoRewrite = normalizeWhitespace(result.referenceVideoRewrite) || buildReferenceVideoRewriteFallback(product);
  result.referenceVideoStructurePlan = normalizeWhitespace(result.referenceVideoStructurePlan) || buildReferenceVideoStructurePlanFallback(product);
  result.referenceVideoTimingPlan = normalizeWhitespace(result.referenceVideoTimingPlan) || timingPlan.displayText;
  result.referenceVideoHarnessCheck = normalizeWhitespace(result.referenceVideoHarnessCheck) || buildReferenceVideoHarnessCheckFallback(product);
  result.recommendedSceneCount = Number(result.recommendedSceneCount || 0) || timingPlan.recommendedSceneCount;
  result.estimatedDurationSeconds = Number(result.estimatedDurationSeconds || 0) || timingPlan.estimatedDurationSeconds;
  const publishFallback = buildTikTokPublishFallback(product, market);
  result.publishTitle = normalizeWhitespace(result.publishTitle) || publishFallback.publishTitle;
  result.publishDescription = normalizeWhitespace(result.publishDescription) || publishFallback.publishDescription;
  result.primaryHashtags = buildPrimaryHashtagSet(result.primaryHashtags, result.backupHashtags, publishFallback.primaryHashtags);
  result.backupHashtags = buildBackupHashtagSet(result.primaryHashtags, result.backupHashtags, publishFallback.backupHashtags);
  result.executionHarness = normalizeWhitespace(result.executionHarness) || buildExecutionHarnessFallback(product, assignedVoice, voiceProfile);
  if (product.referenceVideo && Array.isArray(result.scenes)) {
    const targetSceneCount = timingPlan.recommendedSceneCount || result.scenes.length;
    if (targetSceneCount > 0 && result.scenes.length > targetSceneCount) {
      result.scenes = result.scenes.slice(0, targetSceneCount);
    }
  }
  result.scenes = result.scenes.map((scene: any, index: number) => {
    const genderLockedScene = enforceSceneGenderLock(scene, genderLock);
    const baseScene = {
      ...genderLockedScene,
      prompt: {
        ...genderLockedScene.prompt,
        textPrompt: appendUniqueClauses(
          normalizeWhitespace(genderLockedScene?.prompt?.textPrompt) || buildFallbackImagePrompt(genderLockedScene, index === 0 ? undefined : masterReference),
          referenceHarness.imageClauses
        ),
        videoPrompt: enforceVideoPromptHarness(
          normalizeWhitespace(genderLockedScene?.prompt?.videoPrompt || genderLockedScene?.prompt?.imagePrompt) || buildVeoProductionManifest(genderLockedScene),
          referenceHarness.videoPositiveMandates,
          referenceHarness.videoNegativeMandates
        ),
      },
    };

    return normalizeScene(baseScene, index, index === 0 ? undefined : masterReference);
  });

  return result;
};

export const generateImage = async (
  client: GoogleGenAI,
  prompt: string,
  aspectRatio: AspectRatio,
  resolution: ImageResolution,
  referenceImages: string[] = [],
  modelName: string = GEMINI_MODEL_IMAGE,
  cameraPrompt = '',
  stylePrompt = ''
): Promise<string> => {
  let textPrompt = prompt;
  if (prompt.trim().startsWith('{')) {
    try {
      const json = JSON.parse(prompt);
      const visual = json.veo_production_manifest?.timeline_script?.[0]?.elements?.visuals?.subject_action;
      if (visual) textPrompt = visual;
    } catch {}
  }

  const realismBoosters = [
    textPrompt,
    cameraPrompt,
    stylePrompt,
    'Single coherent frame only. No collage, no split-screen, no storyboard grid, no duplicated subject.',
    IMAGE_POSITIVE_ENHANCEMENTS,
    'Raw photo, 8k, highly detailed skin texture, soft lighting, film grain, shot on Sony A7R.',
    IMAGE_NEGATIVE_PROMPT,
  ].filter(Boolean).join('. ');

  let parsedAspect = '1:1';
  if (aspectRatio === '9:16') parsedAspect = '9:16';
  else if (aspectRatio === '16:9') parsedAspect = '16:9';
  else if (aspectRatio === '4:3') parsedAspect = '4:3';
  else if (aspectRatio === '3:4') parsedAspect = '3:4';

  const parts: any[] = [{ text: realismBoosters }];
  referenceImages.slice(0, 3).forEach(ref => {
    parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: ref } });
  });

  const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts }],
    config: {
      imageConfig: { aspectRatio: parsedAspect as any, imageSize: resolution as any },
    } as any,
  }));

  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
               response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!data) throw new Error('Gemini/FlowAPI model failed to generate image data');
  return data;
};

export const generateSpeech = async (
  client: GoogleGenAI,
  text: string,
  voiceName = 'Kore'
): Promise<string> => {
  const validVoice = VOICE_OPTIONS.includes(voiceName) ? voiceName : 'Kore';
  const response = await withRetry<GenerateContentResponse>(() => client.models.generateContent({
    model: GEMINI_MODEL_TTS,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: validVoice } } },
    },
  }));
  const base64PCM = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64PCM) throw new Error('TTS 服务未返回音频数据');
  return pcmToWav(base64PCM);
};
