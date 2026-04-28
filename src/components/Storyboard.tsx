"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Play, Image as ImageIcon, Wand2, Copy, ChevronDown, ChevronUp, RefreshCw, ArrowRight, Maximize2, Pause, Download, Edit3, X, Check, FileJson, Lock, Zap, Sparkles, Video, Camera, Activity, FileText, Square } from 'lucide-react';
import { StoryboardScene, VideoMode, AspectRatio, GeneratedAsset, GeneratedAssetVariant, ImageResolution } from '@/types';
import { generateImageAPI, generateVideoAPI, optimizePromptAPI } from '@/services/apiClient';
import { AnalysisLoader } from './AnalysisLoader';
import { CAMERA_DEVICES, IMAGE_MODELS, SHOOTING_STYLES } from '@/constants';
import { buildVeoProductionManifestWithVoice } from '@/lib/flow/veoManifest';

const buildMediaProxyUrl = (url: string, filename?: string, download = false) => {
  if (!url || url.startsWith('data:')) {
    return url;
  }

  const params = new URLSearchParams({ url });
  if (filename) {
    params.set('filename', filename);
  }
  if (download) {
    params.set('download', '1');
  }

  return `/api/media?${params.toString()}`;
};

const buildVariantDownloadName = (
  assetType: GeneratedAsset['type'] | undefined,
  sceneIndex: number | undefined,
  variantIndex: number,
  mimeType?: string
) => {
  const extension = assetType === 'video'
    ? 'mp4'
    : mimeType?.includes('png')
      ? 'png'
      : assetType === 'audio'
        ? 'wav'
        : 'jpg';

  if (assetType === 'video') {
    return `分镜${sceneIndex || 1}-${variantIndex}.${extension}`;
  }

  return `分镜${sceneIndex || 1}_${variantIndex}.${extension}`;
};

interface AssetCardProps {
  label: string;
  asset?: GeneratedAsset;
  loading?: boolean;
  onGen: () => void;
  onStop?: () => void;
  onPreview: (url: string, type: 'image' | 'video') => void;
  onViewPrompt: () => void;
  icon: React.ReactNode;
  highlight?: boolean;
  disabled?: boolean;
  title?: string;
  sceneIndex?: number;
  type?: string;
  aspectRatio: AspectRatio;
  onSelectVariant?: (variant: GeneratedAssetVariant) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ 
    label, asset, loading, onGen, onStop, onPreview, onViewPrompt, icon, highlight, disabled, title, sceneIndex, type, aspectRatio, onSelectVariant
}) => {
    const extension = asset?.type === 'video' ? 'mp4' : asset?.mimeType.includes('png') ? 'png' : asset?.type === 'audio' ? 'wav' : 'jpg';
    const downloadName = asset?.type === 'video'
        ? buildVariantDownloadName(asset.type, sceneIndex, 1, asset.mimeType)
        : `${title || 'Scene'}_Scene${sceneIndex}_${type}.${extension}`;
    const mediaHref = asset ? buildMediaProxyUrl(asset.url, downloadName, false) : '#';
    const downloadHref = asset
        ? asset.url.startsWith('data:')
            ? asset.url
            : buildMediaProxyUrl(asset.url, downloadName, true)
        : '#';

    const handleDownloadAllVariants = () => {
        if (!asset?.variants || asset.variants.length === 0) return;

        asset.variants.forEach((variant, index) => {
            const filename = buildVariantDownloadName(asset.type, sceneIndex, index + 1, variant.mimeType);
            const href = variant.url.startsWith('data:')
                ? variant.url
                : buildMediaProxyUrl(variant.url, filename, true);
            const link = document.createElement('a');
            link.href = href;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    // Determine aspect ratio class
    const getAspectRatioClass = () => {
        switch(aspectRatio) {
            case AspectRatio.Ratio_9_16: return 'aspect-[9/16]';
            case AspectRatio.Ratio_16_9: return 'aspect-[16/9]';
            case AspectRatio.Ratio_1_1: return 'aspect-square';
            case AspectRatio.Ratio_3_4: return 'aspect-[3/4]';
            case AspectRatio.Ratio_4_3: return 'aspect-[4/3]';
            default: return 'aspect-[9/16]';
        }
    };

    return (
        <div className={`relative flex-shrink-0 w-48 ${getAspectRatioClass()} rounded-xl border flex flex-col overflow-hidden transition-all group ${highlight ? 'border-brand-500/50 shadow-brand-500/20 shadow-lg' : 'border-slate-800 bg-slate-900/50'}`}>
            {/* Header - Absolute to overlay on image/bg */}
            <div className="bg-slate-900/90 p-2 flex items-center justify-between border-b border-slate-800 z-10 backdrop-blur-sm absolute top-0 left-0 right-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${highlight ? 'text-brand-400' : 'text-slate-400'}`}>
                    {icon} {label}
                </span>
                {asset && (
                    <div className="flex items-center gap-2">
                        {asset.type === 'video' && asset.variants && asset.variants.length > 1 && (
                            <button
                                onClick={handleDownloadAllVariants}
                                className="text-slate-500 hover:text-white transition-colors"
                                title="下载全部候选视频"
                            >
                                <Download size={10} />
                            </button>
                        )}
                        <a
                            href={downloadHref}
                            download={downloadName}
                            className="text-slate-500 hover:text-white transition-colors"
                            title="直接下载"
                        >
                            <Download size={10} />
                        </a>
                        <button onClick={onViewPrompt} className="text-slate-500 hover:text-white transition-colors" title="查看提示词">
                            <Sparkles size={10} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 relative flex items-center justify-center bg-black/20">
                {loading ? (
                    <div className="w-full h-full relative">
                         <AnalysisLoader mode="generation" variant="contained" />
                         {onStop && (
                             <button 
                                onClick={onStop}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-red-500/80 hover:bg-red-500 text-white text-[10px] rounded-full backdrop-blur-md transition-colors flex items-center gap-1"
                             >
                                 <Square size={8} fill="currentColor" /> 停止
                             </button>
                         )}
                    </div>
                ) : asset ? (
                    <>
                        {asset.type === 'video' ? (
                            <video
                                key={mediaHref}
                                src={mediaHref}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                autoPlay
                                loop
                                controls
                                preload="metadata"
                            />
                        ) : (
                            <img 
                                src={mediaHref} 
                                alt={label} 
                                className="w-full h-full object-cover"
                            />
                        )}
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                            <button 
                                onClick={() => onPreview(mediaHref, asset.type)}
                                className="p-2 bg-brand-600 hover:bg-brand-500 rounded-full text-white shadow-lg transform hover:scale-110 transition-all"
                                title="预览大图"
                            >
                                <Maximize2 size={16} />
                            </button>
                            <div className="flex gap-2">
                                {asset.type === 'video' && asset.variants && asset.variants.length > 1 && (
                                    <button
                                        onClick={handleDownloadAllVariants}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white shadow-lg transition-all"
                                        title="下载全部候选视频"
                                    >
                                        <Download size={14} />
                                    </button>
                                )}
                                <a 
                                    href={downloadHref}
                                    download={downloadName}
                                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white shadow-lg transition-all"
                                    title="下载"
                                >
                                    <Download size={14} />
                                </a>
                                <button 
                                    onClick={onGen}
                                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white shadow-lg transition-all"
                                    title="重新生成"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>
                        {asset.variants && asset.variants.length > 1 && onSelectVariant && (
                            <div className="absolute left-2 right-2 bottom-2 flex gap-1 overflow-x-auto rounded-lg bg-black/55 p-1 backdrop-blur-sm">
                                {asset.variants.map((variant, index) => {
                                    const thumbUrl = asset.type === 'image'
                                        ? (variant.url.startsWith('data:')
                                            ? variant.url
                                            : buildMediaProxyUrl(variant.url, `${downloadName}-variant-${index + 1}.jpg`, false))
                                        : '';
                                    const isActive = variant.url === asset.url;
                                    return (
                                        <button
                                            key={`${variant.url}-${index}`}
                                            onClick={() => onSelectVariant(variant)}
                                            className={`flex-shrink-0 overflow-hidden rounded border transition-colors ${asset.type === 'image' ? 'h-12 w-10' : 'px-2 py-1 text-[10px]'} ${isActive ? 'border-brand-400 text-brand-300' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                            title={`${asset.type === 'image' ? '候选图' : '候选视频'} ${index + 1}`}
                                        >
                                            {asset.type === 'image' ? (
                                                <img src={thumbUrl} alt={`variant-${index + 1}`} className="h-full w-full object-cover" />
                                            ) : (
                                                <span>{`视频${index + 1}`}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 p-4 text-center mt-8">
                        <button 
                            onClick={onGen}
                            disabled={disabled}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${
                                disabled 
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                                : highlight 
                                    ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/30' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                            <Wand2 size={16} />
                        </button>
                        {disabled ? (
                            <span className="text-[10px] text-slate-600">需先生成前序分镜</span>
                        ) : (
                            <span className="text-[10px] text-slate-500">点击生成</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

interface Props {
  scenes: StoryboardScene[];
  videoMode: VideoMode;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  imageModel: string;
  cameraDevice: string;
  shootingStyle: string;
  productImages: string[];
  modelImages: string[];
  backgroundImages: string[];
  assignedVoice: string;
  onUpdateScene: (id: string, updates: Partial<StoryboardScene>) => void;
  onPreview: (url: string, type: 'image' | 'video') => void;
  productTitle: string;
}

export const Storyboard: React.FC<Props> = ({ 
    scenes, videoMode, aspectRatio, resolution, imageModel, cameraDevice, shootingStyle, productImages, modelImages, backgroundImages, assignedVoice,
    onUpdateScene, onPreview, productTitle
}) => {
  const [expandedScene, setExpandedScene] = useState<string | null>(scenes[0]?.id || null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [promptModal, setPromptModal] = useState<{ isOpen: boolean; content: string } | null>(null);
  
  // Track abort controllers for each scene and generation type
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const scenesRef = useRef(scenes);
  const generationTokens = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    scenesRef.current = scenes;
  }, [scenes]);

  const toggleExpand = (id: string) => {
    setExpandedScene(expandedScene === id ? null : id);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const selectedImageModel = IMAGE_MODELS.find((model) => model.value === imageModel)?.label || imageModel;

  const getVideoManifestPrompt = (scene: StoryboardScene) =>
      scene.prompt.videoPromptCustom
          ? (scene.prompt.videoPrompt || scene.prompt.imagePrompt || '')
          : buildVeoProductionManifestWithVoice(scene, { voiceName: assignedVoice });

  const buildStoryboardVideoPrompt = (scene: StoryboardScene) => {
      const manifestPrompt = getVideoManifestPrompt(scene);
      if (manifestPrompt) {
          return manifestPrompt;
      }
      return [
          scene.prompt.textPrompt || scene.visual_en || scene.visual,
          scene.action_en || scene.action ? `Action: ${scene.action_en || scene.action}` : '',
          scene.camera_en || scene.camera ? `Camera movement: ${scene.camera_en || scene.camera}` : '',
      ].filter(Boolean).join('\n');
  };

  const getSceneVideoReferenceImages = (scene: StoryboardScene) => {
      return [
          scene.startImage?.data,
          scene.middleImage?.data,
          scene.endImage?.data,
      ].filter((image): image is string => Boolean(image));
  };

  const createGenerationToken = (key: string) => {
      const nextToken = (generationTokens.current.get(key) || 0) + 1;
      generationTokens.current.set(key, nextToken);
      return nextToken;
  };

  const isLatestGeneration = (key: string, token: number) => {
      return generationTokens.current.get(key) === token;
  };

  const mergeVariants = (
      existing: GeneratedAssetVariant[] = [],
      incoming: GeneratedAssetVariant[] = []
  ) => {
      const seen = new Set<string>();
      return [...existing, ...incoming].filter((variant) => {
          const key = variant.data || variant.url;
          if (!key || seen.has(key)) {
              return false;
          }
          seen.add(key);
          return true;
      });
  };

  const getSceneAsset = (sceneId: string, type: 'start' | 'middle' | 'end' | 'video') => {
      const currentScene = scenesRef.current.find((item) => item.id === sceneId);
      if (!currentScene) return undefined;
      if (type === 'start') return currentScene.startImage;
      if (type === 'middle') return currentScene.middleImage;
      if (type === 'end') return currentScene.endImage;
      return currentScene.video;
  };

  const buildImageAsset = (
      base64: string,
      images?: Array<{ url: string; mimeType: string; base64: string }>,
      currentAsset?: GeneratedAsset
  ): GeneratedAsset => {
      const primaryUrl = `data:image/jpeg;base64,${base64}`;
      const incomingVariants = (images && images.length > 0 ? images : [{ url: primaryUrl, mimeType: 'image/jpeg', base64 }]).map((image) => ({
          url: image.url.startsWith('data:') ? image.url : `data:${image.mimeType};base64,${image.base64}`,
          mimeType: image.mimeType,
          data: image.base64,
      }));
      const variants = mergeVariants(currentAsset?.variants || [], incomingVariants);
      const activeVariant = variants.find((variant) =>
          currentAsset?.data ? variant.data === currentAsset.data : variant.url === currentAsset?.url
      ) || variants[0];

      return {
          type: 'image',
          url: activeVariant?.url || primaryUrl,
          mimeType: activeVariant?.mimeType || 'image/jpeg',
          data: activeVariant?.data || base64,
          variants,
      };
  };

  const buildVideoAsset = (
      url: string,
      videos?: Array<{ url: string; mimeType: string }>,
      currentAsset?: GeneratedAsset
  ): GeneratedAsset => {
      const incomingVariants = (videos && videos.length > 0 ? videos : [{ url, mimeType: 'video/mp4' }]).map((video) => ({
          url: video.url,
          mimeType: video.mimeType,
      }));
      const variants = mergeVariants(currentAsset?.variants || [], incomingVariants);
      const activeVariant = variants.find((variant) => variant.url === currentAsset?.url) || variants[0];

      return {
          type: 'video',
          url: activeVariant?.url || url,
          mimeType: activeVariant?.mimeType || 'video/mp4',
          variants,
      };
  };

  const handleSelectImageVariant = (
    scene: StoryboardScene,
    type: 'start' | 'middle' | 'end',
    variant: GeneratedAssetVariant
  ) => {
    const currentAsset =
      type === 'start' ? scene.startImage :
      type === 'middle' ? scene.middleImage :
      scene.endImage;

    if (!currentAsset) return;

    const updatedAsset: GeneratedAsset = {
      ...currentAsset,
      url: variant.url,
      mimeType: variant.mimeType,
      data: variant.data,
    };

    if (type === 'start') onUpdateScene(scene.id, { startImage: updatedAsset });
    else if (type === 'middle') onUpdateScene(scene.id, { middleImage: updatedAsset });
    else onUpdateScene(scene.id, { endImage: updatedAsset });
  };

  // NEW: Generate All Subsequent Scenes based on Scene 1
  const handleGenerateRemaining = async () => {
      const scene1 = scenes[0];
      if (!scene1.startImage?.data) {
          alert("必须先生成【分镜 1】的画面，作为后续分镜的一致性基准。");
          setExpandedScene(scene1.id);
          return;
      }
      
      setIsGeneratingAll(true);

      // Iterate sequentially to prevent rate limits and ensure order
      for (let i = 1; i < scenes.length; i++) {
          const scene = scenes[i];
          // Scroll or expand visually? Maybe just expand the one being generated
          setExpandedScene(scene.id);
          
          // Generate Start Image
          await handleGenerateImage(scene, 'start', undefined, scene1.startImage.data); // Force injection of Scene 1
          
          if (videoMode === VideoMode.Intermediate) {
               await handleGenerateImage(scene, 'middle', undefined, scene1.startImage.data);
          }
          if (videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) {
               await handleGenerateImage(scene, 'end', undefined, scene1.startImage.data);
          }
      }
      
      setIsGeneratingAll(false);
  };

  const handleStopGeneration = (sceneId: string, type: 'start' | 'end' | 'middle') => {
      const abortKey = `${sceneId}_${type}`;
      if (abortControllers.current.has(abortKey)) {
          abortControllers.current.get(abortKey)?.abort();
          abortControllers.current.delete(abortKey);
      }
      createGenerationToken(`${sceneId}_${type}_image`);
      const stopUpdate: Partial<StoryboardScene> = {};
      if (type === 'start') stopUpdate.isGeneratingStart = false;
      if (type === 'middle') stopUpdate.isGeneratingMiddle = false;
      if (type === 'end') stopUpdate.isGeneratingEnd = false;
      onUpdateScene(sceneId, stopUpdate);
  };
  const handleGenerateImage = async (
    scene: StoryboardScene, 
    type: 'start' | 'end' | 'middle', 
    customPrompt?: string,
    forcedReferenceImage?: string // From Scene 1
  ): Promise<string | undefined> => {
    
    // Safety Check: Consistency enforcement
    const sceneIndex = scenes.findIndex(s => s.id === scene.id);
    if (sceneIndex > 0 && !forcedReferenceImage && !scenes[0].startImage?.data) {
        alert("请先生成【分镜 1】。后续分镜需要基于分镜1保持角色一致性。");
        return;
    }

    // Cancel existing if any
    const abortKey = `${scene.id}_${type}`;
    if (abortControllers.current.has(abortKey)) {
        abortControllers.current.get(abortKey)?.abort();
    }
    const controller = new AbortController();
    abortControllers.current.set(abortKey, controller);
    const generationKey = `${scene.id}_${type}_image`;
    const generationToken = createGenerationToken(generationKey);

    const loadingUpdate = {
        isGeneratingStart: type === 'start' ? true : scene.isGeneratingStart,
        isGeneratingMiddle: type === 'middle' ? true : scene.isGeneratingMiddle,
        isGeneratingEnd: type === 'end' ? true : scene.isGeneratingEnd,
        error: undefined
    };
    onUpdateScene(scene.id, loadingUpdate);

    try {
      let prompt = customPrompt || scene.prompt.textPrompt || scene.prompt.imagePrompt;
      let referenceImages: string[] = [];

      const scene1Ref = forcedReferenceImage || (sceneIndex > 0 ? scenes[0].startImage?.data : null);
      if (scene1Ref) {
          referenceImages.push(scene1Ref);
      }

      if (modelImages && modelImages.length > 0) referenceImages.push(...modelImages);
      if (backgroundImages && backgroundImages.length > 0) referenceImages.push(...backgroundImages);
      
      if (referenceImages.length < 3 && productImages && productImages.length > 0) {
          referenceImages.push(...productImages.slice(0, 2)); 
      }
      
      if (type === 'middle') {
        const startImg = scene.startImage?.data;
        if (startImg) referenceImages.unshift(startImg);
      } 
      else if (type === 'end') {
          const startImg = scene.startImage?.data;
          if (startImg) referenceImages.unshift(startImg);
      }

      let targetResolution = resolution;
      if (videoMode === VideoMode.Intermediate && type === 'middle') {
          targetResolution = ImageResolution.Res_1K;
      }

      const cameraPrompt = CAMERA_DEVICES.find((c: any) => c.value === cameraDevice)?.prompt || '';
      const stylePrompt = SHOOTING_STYLES.find((s: any) => s.value === shootingStyle)?.prompt || '';

      const primaryResult = await generateImageAPI(
          prompt, 
          aspectRatio, 
          targetResolution, 
          referenceImages, 
          imageModel,
          cameraPrompt,
          stylePrompt,
          1
      );

      if (!isLatestGeneration(generationKey, generationToken)) {
          return undefined;
      }

      const primaryAsset = buildImageAsset(primaryResult.base64, primaryResult.images);

      if (type === 'start') onUpdateScene(scene.id, { startImage: primaryAsset });
      else if (type === 'end') onUpdateScene(scene.id, { endImage: primaryAsset });
      else if (type === 'middle') onUpdateScene(scene.id, { middleImage: primaryAsset });

      void (async () => {
          try {
              const extraResult = await generateImageAPI(
                  prompt,
                  aspectRatio,
                  targetResolution,
                  referenceImages,
                  imageModel,
                  cameraPrompt,
                  stylePrompt,
                  3
              );

              if (!isLatestGeneration(generationKey, generationToken)) {
                  return;
              }

              const currentAsset = getSceneAsset(scene.id, type);
              const mergedAsset = buildImageAsset(
                  currentAsset?.data || primaryResult.base64,
                  extraResult.images,
                  currentAsset
              );

              if (type === 'start') onUpdateScene(scene.id, { startImage: mergedAsset });
              else if (type === 'end') onUpdateScene(scene.id, { endImage: mergedAsset });
              else if (type === 'middle') onUpdateScene(scene.id, { middleImage: mergedAsset });
          } catch (error) {
              console.warn(`补充候选图失败: ${scene.id}/${type}`, error);
          }
      })();

      return primaryResult.base64;
    } catch (e: any) {
      if (e.name === 'AbortError') {
          console.log(`Generation for scene ${scene.id} ${type} stopped by user.`);
      } else {
          onUpdateScene(scene.id, { error: `生成失败: ${e.message}` });
      }
      return undefined;
    } finally {
       abortControllers.current.delete(abortKey);
       if (isLatestGeneration(generationKey, generationToken)) {
           const finalUpdate: any = {};
           if(type === 'start') finalUpdate.isGeneratingStart = false;
           if(type === 'middle') finalUpdate.isGeneratingMiddle = false;
           if(type === 'end') finalUpdate.isGeneratingEnd = false;
           onUpdateScene(scene.id, finalUpdate);
       }
    }
  };

  const handleGenerateVideo = async (scene: StoryboardScene) => {
    const referenceImages = getSceneVideoReferenceImages(scene);
    if (referenceImages.length === 0) {
        onUpdateScene(scene.id, { error: '请先生成至少一张分镜图，再生成视频' });
        return;
    }

    const generationKey = `${scene.id}_video`;
    const generationToken = createGenerationToken(generationKey);

    onUpdateScene(scene.id, { isGeneratingVideo: true, error: undefined });
    try {
        const cameraPrompt = CAMERA_DEVICES.find((c: any) => c.value === cameraDevice)?.prompt || '';
        const stylePrompt = SHOOTING_STYLES.find((s: any) => s.value === shootingStyle)?.prompt || '';
        const prompt = buildStoryboardVideoPrompt(scene);
        const primaryResult = await generateVideoAPI(prompt, aspectRatio, referenceImages, cameraPrompt, stylePrompt, 1);

        if (!isLatestGeneration(generationKey, generationToken)) {
            return;
        }

        const primaryAsset = buildVideoAsset(primaryResult.url, primaryResult.videos);
        onUpdateScene(scene.id, { video: primaryAsset });

        void (async () => {
            try {
                const extraResult = await generateVideoAPI(prompt, aspectRatio, referenceImages, cameraPrompt, stylePrompt, 3);
                if (!isLatestGeneration(generationKey, generationToken)) {
                    return;
                }

                const currentAsset = getSceneAsset(scene.id, 'video');
                const mergedAsset = buildVideoAsset(currentAsset?.url || primaryResult.url, extraResult.videos, currentAsset);
                onUpdateScene(scene.id, { video: mergedAsset });
            } catch (error) {
                console.warn(`补充候选视频失败: ${scene.id}`, error);
            }
        })();
    } catch (e) {
        onUpdateScene(scene.id, { error: `视频失败: ${(e as Error).message}` });
    } finally {
        if (isLatestGeneration(generationKey, generationToken)) {
            onUpdateScene(scene.id, { isGeneratingVideo: false });
        }
    }
  };
  const handleOptimizePrompt = async (scene: StoryboardScene) => {
      onUpdateScene(scene.id, { isUpdatingPrompt: true });
      try {
          // CONSISTENCY LOGIC:
          // If this is Scene 2+, we MUST pass Scene 1's prompt as the "Master"
          const sceneIndex = scenes.findIndex(s => s.id === scene.id);
          const masterPrompt = sceneIndex > 0 ? (scenes[0].prompt.textPrompt || scenes[0].visual_en) : undefined;
          
          // Optimize the TEXT prompt (not the Veo JSON)
          const promptToOptimize = scene.prompt.textPrompt || scene.visual_en;
          const newPrompt = await optimizePromptAPI(promptToOptimize, scene.visual_en || scene.visual, masterPrompt);
          
          onUpdateScene(scene.id, { prompt: { ...scene.prompt, textPrompt: newPrompt } });
      } catch (e) {
          console.error("Prompt optimization failed", e);
      } finally {
          onUpdateScene(scene.id, { isUpdatingPrompt: false });
      }
  }

  const updatePrompt = (id: string, value: string) => {
      const scene = scenes.find(s => s.id === id);
      if (scene) {
          onUpdateScene(id, { prompt: { ...scene.prompt, videoPrompt: value, videoPromptCustom: true } });
      }
  }

  return (
    <div className="space-y-6 relative">
      
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 sticky top-24 z-30 bg-dark-950/80 p-2 rounded-lg backdrop-blur border border-slate-800 shadow-lg">
           <div className="flex items-center gap-3">
               <button 
                  onClick={handleGenerateRemaining}
                  disabled={isGeneratingAll || !scenes[0]?.startImage}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${isGeneratingAll || !scenes[0]?.startImage ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-900/50'}`}
               >
                   <Zap size={14} className={isGeneratingAll ? 'animate-pulse' : ''} />
                   {isGeneratingAll ? '正在依序生成...' : '基于分镜1生成剩余全部'}
               </button>
               {!scenes[0]?.startImage && (
                   <span className="text-[10px] text-orange-400 flex items-center gap-1">
                       <Lock size={10} /> 需先生成分镜1
                   </span>
               )}
           </div>
           
            <div className="flex items-center gap-3">
                 {/* Model Badge (New) */}
                 <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 hidden lg:flex">
                     <span className="text-[10px] font-bold text-slate-500">模型</span>
                     <span className="text-[10px] text-sky-400 font-mono">
                         {selectedImageModel}
                     </span>
                </div>

                {/* Resolution Badge */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500">分辨率</span>
                    <span className="text-[10px] text-brand-400 font-mono">
                            {imageModel.includes('flash') ? '默认' : resolution}
                    </span>
                </div>
           </div>
      </div>

      {scenes.map((scene, index) => {
        const isScene1 = index === 0;
        const isLocked = !isScene1 && !scenes[0].startImage;

        return (
            <div key={scene.id} className={`rounded-xl border transition-all shadow-lg ${isLocked ? 'bg-slate-900/30 border-slate-800 opacity-70' : 'bg-slate-900 border-slate-700 hover:border-slate-600'}`}>
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-slate-800 cursor-pointer" onClick={() => toggleExpand(scene.id)}>
                <div className="flex items-center gap-4">
                <span className={`text-xs font-bold px-2 py-1 rounded shadow ${isScene1 ? 'bg-brand-600 text-white shadow-brand-500/20' : 'bg-slate-700 text-slate-300'}`}>
                    分镜 {index + 1} {isScene1 && <span className="ml-1 text-[10px] bg-white/20 px-1 rounded">主镜头</span>}
                </span>
                <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-200 truncate max-w-md">{scene.visual || '未命名分镜'}</h3>
                    <span className="text-xs text-slate-500 truncate max-w-md">{scene.action}</span>
                </div>
                </div>
                <div className="flex items-center gap-2">
                    {isLocked && <Lock size={16} className="text-slate-600" />}
                    <button className="text-slate-400 hover:text-white transition-transform duration-200" style={{ transform: expandedScene === scene.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <ChevronDown />
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            <div className={`border-t border-slate-700/50 bg-slate-950/30 ${expandedScene === scene.id ? 'block' : 'hidden'}`}>
                <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Left: Script & Prompts (5 cols - Increased width for prompt) */}
                <div className="xl:col-span-5 space-y-5">
                    
                    {(scene.title || scene.objective) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {scene.title && (
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                    <label className="text-[10px] uppercase text-amber-400 font-bold tracking-wider block mb-1">分镜标题</label>
                                    <p className="text-sm text-slate-200 leading-relaxed">{scene.title}</p>
                                </div>
                            )}
                            {scene.objective && (
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                    <label className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider block mb-1">分镜目标</label>
                                    <p className="text-sm text-slate-300 leading-relaxed">{scene.objective}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visual / Action / Camera Inputs */}
                    <div className="space-y-3">
                        {/* Visual */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider flex items-center gap-1">
                                <ImageIcon size={10} /> 画面内容
                            </label>
                            <textarea 
                                value={scene.visual}
                                onChange={(e) => onUpdateScene(scene.id, { visual: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                                rows={2}
                            />
                        </div>

                         {/* Action - ADDED BACK */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider flex items-center gap-1">
                                <Activity size={10} /> 动作设计
                            </label>
                            <input 
                                value={scene.action}
                                onChange={(e) => onUpdateScene(scene.id, { action: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                            />
                        </div>

                        {/* Camera - ADDED BACK */}
                         <div className="space-y-1">
                            <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider flex items-center gap-1">
                                <Camera size={10} /> 运镜设计
                            </label>
                            <input 
                                value={scene.camera}
                                onChange={(e) => onUpdateScene(scene.id, { camera: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                            />
                        </div>

                        {/* Text-to-Image Prompt Display (Prominent Copy) */}
                        <div className="space-y-1 pt-4 border-t border-slate-800/50 mt-2">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] uppercase text-sky-400 font-bold tracking-wider flex items-center gap-1">
                                    <Sparkles size={10} /> 文生图提示词
                                </label>
                                <button 
                                    onClick={() => copyToClipboard(scene.prompt.textPrompt || scene.visual_en)}
                                    className="text-[10px] bg-sky-600/20 hover:bg-sky-500 text-sky-400 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-sky-500/20"
                                >
                                    <Copy size={10} /> 一键复制
                                </button>
                            </div>
                            <div className="relative group">
                                 <textarea 
                                    readOnly
                                    value={scene.prompt.textPrompt || scene.visual_en || ''}
                                    className="w-full bg-slate-950 border border-sky-900/30 rounded p-2 text-xs text-sky-100/70 focus:outline-none custom-scrollbar font-mono leading-relaxed"
                                    rows={4}
                                />
                            </div>
                        </div>

                        {/* Veo Manifest Editor */}
                        <div className="space-y-1 pt-2 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] uppercase text-purple-400 font-bold tracking-wider flex items-center gap-1">
                                    <Video size={10} /> 图片转视频 JSON 提示词
                                </label>
                                <button 
                                    onClick={() => copyToClipboard(getVideoManifestPrompt(scene))}
                                    className="text-[10px] bg-purple-600/20 hover:bg-purple-500 text-purple-400 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-purple-500/20"
                                >
                                    <Copy size={10} /> 一键复制
                                </button>
                            </div>
                            <div className="relative">
                                 <textarea 
                                    value={getVideoManifestPrompt(scene)}
                                    onChange={(e) => updatePrompt(scene.id, e.target.value)}
                                    className="w-full bg-black/30 border border-purple-900/30 rounded p-2 text-[10px] text-purple-300 font-mono focus:border-purple-500 focus:outline-none leading-tight shadow-inner"
                                    rows={10}
                                    placeholder="等待生成视频 JSON 提示词..."
                                />
                            </div>
                        </div>

                        {/* Dialogue */}
                        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-800/50">
                            {/* Chinese Dialogue */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">对白中文释义</label>
                                <input 
                                value={scene.dialogue_cn || ''}
                                onChange={(e) => onUpdateScene(scene.id, { dialogue_cn: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-400 focus:border-slate-500 focus:outline-none"
                                placeholder="等待生成..."
                                />
                            </div>
                            
                            {/* Target Language Dialogue */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase text-brand-400 font-bold tracking-wider">口播台词</label>
                                <input 
                                value={scene.dialogue}
                                onChange={(e) => onUpdateScene(scene.id, { dialogue: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-brand-500 focus:outline-none font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Asset Generation (7 cols) */}
                <div className="xl:col-span-7">
                    <div className="flex flex-col gap-6 h-full">
                        
                        {/* Visual Asset Flow */}
                        <div className="flex gap-4 overflow-x-auto pb-4 items-start custom-scrollbar">
                            {/* Start Frame */}
                            <AssetCard 
                                label="首帧图" 
                                asset={scene.startImage} 
                                loading={scene.isGeneratingStart} 
                                onGen={() => handleGenerateImage(scene, 'start')} 
                                onStop={() => handleStopGeneration(scene.id, 'start')}
                                onPreview={onPreview}
                                onViewPrompt={() => setPromptModal({ isOpen: true, content: scene.prompt.textPrompt || scene.visual_en })}
                                icon={<ImageIcon size={14} />}
                                disabled={isLocked}
                                title={productTitle}
                                sceneIndex={index + 1}
                                type="start"
                                aspectRatio={aspectRatio}
                                onSelectVariant={(variant) => handleSelectImageVariant(scene, 'start', variant)}
                            />
                            
                            {(videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) && (
                                <div className="mt-20 text-slate-700 hidden md:block"><ArrowRight size={16} /></div>
                            )}

                            {/* Middle Frame */}
                            {videoMode === VideoMode.Intermediate && (
                                <>
                                    <AssetCard 
                                        label="分镜草稿" 
                                        asset={scene.middleImage} 
                                        loading={scene.isGeneratingMiddle} 
                                        onGen={() => handleGenerateImage(scene, 'middle')} 
                                        onStop={() => handleStopGeneration(scene.id, 'middle')}
                                        onPreview={onPreview}
                                        onViewPrompt={() => setPromptModal({ isOpen: true, content: scene.prompt.textPrompt || scene.visual_en })}
                                        icon={<Wand2 size={14} />}
                                        highlight
                                        disabled={isLocked}
                                        title={productTitle}
                                        sceneIndex={index + 1}
                                        type="draft"
                                        aspectRatio={aspectRatio}
                                        onSelectVariant={(variant) => handleSelectImageVariant(scene, 'middle', variant)}
                                    />
                                    <div className="mt-20 text-slate-700 hidden md:block"><ArrowRight size={16} /></div>
                                </>
                            )}

                            {/* End Frame */}
                            {(videoMode === VideoMode.StartEnd || videoMode === VideoMode.Intermediate) && (
                                <>
                                    <AssetCard 
                                        label="尾帧图" 
                                        asset={scene.endImage} 
                                        loading={scene.isGeneratingEnd} 
                                        onGen={() => handleGenerateImage(scene, 'end')} 
                                        onStop={() => handleStopGeneration(scene.id, 'end')}
                                        onPreview={onPreview}
                                        onViewPrompt={() => setPromptModal({ isOpen: true, content: scene.prompt.textPrompt || scene.visual_en })}
                                        icon={<ImageIcon size={14} />}
                                        disabled={isLocked}
                                        title={productTitle}
                                        sceneIndex={index + 1}
                                        type="end"
                                        aspectRatio={aspectRatio}
                                        onSelectVariant={(variant) => handleSelectImageVariant(scene, 'end', variant)}
                                    />
                                </>
                            )}

                            <div className="mt-20 text-slate-700 hidden md:block"><ArrowRight size={16} /></div>
                            <AssetCard
                                label="分镜视频"
                                asset={scene.video}
                                loading={scene.isGeneratingVideo}
                                onGen={() => handleGenerateVideo(scene)}
                                onPreview={onPreview}
                                onViewPrompt={() => setPromptModal({ isOpen: true, content: buildStoryboardVideoPrompt(scene) })}
                                icon={<Video size={14} />}
                                highlight
                                disabled={!scene.startImage}
                                title={productTitle}
                                sceneIndex={index + 1}
                                type="video"
                                aspectRatio={aspectRatio}
                                onSelectVariant={(variant) => {
                                    if (!scene.video) return;
                                    onUpdateScene(scene.id, {
                                        video: {
                                            ...scene.video,
                                            url: variant.url,
                                            mimeType: variant.mimeType,
                                        },
                                    });
                                }}
                            />
                        </div>

                    </div>
                    {scene.error && (
                        <div className="mt-3 text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-900/50 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {scene.error}
                        </div>
                    )}
                </div>
                </div>
            </div>
            </div>
        );
      })}

      {/* Prompt Modal - Kept for Asset Card View Button if needed, but text is now inline */}
      {promptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPromptModal(null)}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setPromptModal(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                      <X size={20} />
                  </button>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Sparkles className="text-brand-500" size={18} /> 文生图提示词 (Text-to-Image)
                  </h3>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-4 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {promptModal.content}
                      </p>
                  </div>
                  <button 
                      onClick={() => {
                          copyToClipboard(promptModal.content);
                          setPromptModal(null);
                      }}
                      className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                      <Copy size={18} /> 一键复制提示词
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};



