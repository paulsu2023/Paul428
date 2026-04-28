
import { AspectRatio, VideoMode, ImageResolution } from './types';

// Analysis runs on Google's official Gemini API.
export const GEMINI_MODEL_ANALYSIS = 'gemini-2.5-flash';

// Fallback model
export const GEMINI_MODEL_ANALYSIS_FALLBACK = 'gemini-2.5-flash-lite';

export const ANALYSIS_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite Preview' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
] as const;

// Using Imagen 3 for high quality assets
export const GEMINI_MODEL_IMAGE = 'imagen-3.0-generate-002'; 

// TTS Model
export const GEMINI_MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const TARGET_MARKETS = [
  { value: 'US', label: 'United States (美国)', language: 'English', culture: 'Western, diverse American style, energetic and direct', disabled: false },
  { value: 'MX', label: 'Mexico (墨西哥)', language: 'Spanish', culture: 'Mexican/Latin American ethnicity, vibrant, warm, family-oriented and social style', disabled: false },
  { value: 'BR', label: 'Brazil (巴西)', language: 'Portuguese', culture: 'Brazilian ethnicity, vibrant, diverse, and energetic South American style', disabled: false },
];

export const ASPECT_RATIOS = [
  { value: AspectRatio.Ratio_9_16, label: '9:16 (竖屏通用)' },
  { value: AspectRatio.Ratio_16_9, label: '16:9 (横屏通用)' },
  { value: AspectRatio.Ratio_1_1, label: '1:1 (正方形)' },
  { value: AspectRatio.Ratio_3_4, label: '3:4 (肖像)' },
  { value: AspectRatio.Ratio_4_3, label: '4:3 (传统)' },
];

export const IMAGE_RESOLUTIONS = [
  { value: ImageResolution.Res_1K, label: '1K (标准)' },
  { value: ImageResolution.Res_2K, label: '2K (高清 - 推荐)' },
  { value: ImageResolution.Res_4K, label: '4K (超清)' },
];

export const VIDEO_MODES = [
  { value: VideoMode.Standard, label: '首帧图 (仅生成首图)' },
  { value: VideoMode.StartEnd, label: '连贯模式 (首图+尾图)' },
  { value: VideoMode.Intermediate, label: '运镜控制模式 (首图+草稿+尾图)' },
];

// Model Selection for Image Generation
export const IMAGE_MODELS = [
  { value: 'gemini-2.5-flash-image', label: 'Flow Flash (极速)' },
  { value: 'gemini-3.0-pro-image', label: 'Flow Pro (高清)' },
  { value: 'gemini-3.1-flash-image', label: 'Flow Narwhal (新版)' },
  { value: 'imagen-4.0-generate-preview', label: 'Flow Imagen (稳妥)' },
];

export const VOICE_OPTIONS = ['Kore', 'Fenrir', 'Puck', 'Charon', 'Zephyr'];

export const CAMERA_DEVICES = [
  { value: 'iphone_16_pro_max', label: 'iPhone 16 Pro Max', prompt: 'shot on iPhone 16 Pro Max, 48MP raw, sharp focus, computational photography, natural hdr, highly detailed' },
  { value: 'iphone_15_pro_max', label: 'iPhone 15 Pro Max', prompt: 'shot on iPhone 15 Pro Max, 48MP, realistic texture, apple color science, ultra wide angle' },
  { value: 'sony_a7r_v', label: 'Sony A7R V (专业摄影)', prompt: 'shot on Sony A7R V, 61MP, FE 24-70mm GM lens, shallow depth of field, sharp details, bokeh, professional photography' },
  { value: 'arri_alexa', label: 'ARRI Alexa (电影级)', prompt: 'shot on ARRI Alexa Mini, cinematic lighting, color graded, movie production quality, anamorphic lens, film look' },
  { value: 'film_camera', label: 'Film Camera (胶片感)', prompt: 'shot on Kodak Portra 400, 35mm film grain, vintage texture, warm tones, analog photography' },
  { value: 'gopro_hero_12', label: 'GoPro Hero 12 (运动)', prompt: 'shot on GoPro Hero 12, wide angle, fisheye effect, high contrast, sharp, action camera style' },
];

export const SHOOTING_STYLES = [
  { value: 'fixed', label: '固定机位 (Fixed)', prompt: 'static camera, tripod shot, stable composition, centered subject' },
  { value: 'pov', label: '第一人称 (POV)', prompt: 'POV shot, first-person view, immersive perspective, looking through eyes, hands visible in frame' },
  { value: 'handheld', label: '手持跟拍 (Handheld)', prompt: 'handheld camera, slight shake, documentary style, realistic movement, dynamic angle' },
  { value: 'gimbal', label: '稳定器运镜 (Gimbal)', prompt: 'smooth gimbal shot, cinematic movement, floating camera, steady flow' },
  { value: 'mixed', label: '混合运镜 (Mixed)', prompt: 'cinematic movement, dynamic angles, smooth transition, creative camera work' },
];

export const CREDIT_PACKAGES = [
  { id: 'starter', name: '体验包', credits: 50, price: 2900, currency: 'cny', description: '适合初次体验', popular: false },
  { id: 'standard', name: '标准包', credits: 200, price: 9900, currency: 'cny', description: '最受欢迎', popular: true },
  { id: 'pro', name: '专业包', credits: 800, price: 29900, currency: 'cny', description: '专业用户首选', popular: false }
] as const;

export const CREDIT_COSTS = { ANALYZE: 5, IMAGE_GEN: 2, AUDIO_GEN: 1, VIDEO_GEN: 6 } as const;
