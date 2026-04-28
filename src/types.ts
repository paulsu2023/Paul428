export enum AspectRatio {
  Ratio_9_16 = '9:16',
  Ratio_16_9 = '16:9',
  Ratio_1_1 = '1:1',
  Ratio_4_3 = '4:3',
  Ratio_3_4 = '3:4',
}

export enum ImageResolution {
  Res_1K = '1K',
  Res_2K = '2K',
  Res_4K = '4K',
}

export enum VideoMode {
  Standard = 'standard',
  StartEnd = 'start_end',
  Intermediate = 'intermediate',
}

export interface ReferenceVideoData {
  previewUrl: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  analysisFrames: string[];
}

export interface ProductData {
  images: string[];
  title: string;
  description: string;
  creativeIdeas: string;
  targetMarket: string;
  modelImages: string[];
  backgroundImages: string[];
  referenceVideo?: ReferenceVideoData | null;
}

export interface ComplianceCheck {
  isCompliant: boolean;
  riskLevel: 'Safe' | 'Warning' | 'High Risk';
  report: string;
  culturalNotes: string;
}

export interface AnalysisResult {
  productType: string;
  productSpecs: string;
  sellingPoints: string;
  targetAudience: string;
  hook: string;
  painPoints: string;
  strategy: string;
  modelRequirements: string;
  backgroundGuidance: string;
  realismGuidance: string;
  assetMatchingGuidance: string;
  referenceVideoAnalysis: string;
  referenceVideoScriptExtraction: string;
  referenceVideoRewrite: string;
  referenceVideoStructurePlan: string;
  referenceVideoTimingPlan: string;
  referenceVideoHarnessCheck: string;
  recommendedSceneCount?: number;
  estimatedDurationSeconds?: number;
  publishTitle: string;
  publishDescription: string;
  primaryHashtags: string[];
  backupHashtags: string[];
  executionHarness: string;
  assignedVoice: string;
  complianceCheck: ComplianceCheck;
  scenes: SceneDraft[];
}

export interface SceneDraft {
  id: string;
  title?: string;
  objective?: string;
  visual: string;
  visual_en: string;
  action: string;
  action_en: string;
  camera: string;
  camera_en: string;
  dialogue: string;
  dialogue_cn: string;
  prompt: {
    textPrompt: string;
    imagePrompt: string;
    videoPrompt: string;
    videoPromptCustom?: boolean;
  };
}

export interface GeneratedAssetVariant {
  url: string;
  mimeType: string;
  data?: string;
}

export interface GeneratedAsset {
  type: 'image' | 'audio' | 'video';
  url: string;
  mimeType: string;
  data?: string;
  variants?: GeneratedAssetVariant[];
}

export interface StoryboardScene extends SceneDraft {
  startImage?: GeneratedAsset;
  endImage?: GeneratedAsset;
  middleImage?: GeneratedAsset;
  audio?: GeneratedAsset;
  video?: GeneratedAsset;
  isGeneratingImage: boolean;
  isGeneratingAudio: boolean;
  error?: string;
  isGeneratingStart?: boolean;
  isGeneratingMiddle?: boolean;
  isGeneratingEnd?: boolean;
  isGeneratingVideo?: boolean;
  isUpdatingPrompt?: boolean;
}

export interface AppState {
  product: ProductData;
  settings: {
    aspectRatio: AspectRatio;
    imageResolution: ImageResolution;
    videoMode: VideoMode;
    sceneCount: number;
    analysisModel: string;
    imageModel: string;
    cameraDevice: string;
    shootingStyle: string;
  };
  analysis: AnalysisResult | null;
  storyboard: StoryboardScene[];
  isAnalyzing: boolean;
  isGeneratingScene: boolean;
  activeStep: number;
}

export interface UserGeminiConfig {
  apiKey: string;
  baseUrl?: string;
}
 
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  credits: number;
  plan: 'free' | 'pro' | 'enterprise';
  avatar_url?: string;
}
