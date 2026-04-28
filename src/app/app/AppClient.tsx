"use client";

import React, { useEffect, useState } from 'react';
import { Bot, Layers, LayoutTemplate, Settings2, Sparkles, AlertCircle, X, ChevronRight, ChevronDown, ChevronUp, BrainCircuit, Minus, Plus, Download, Lock, KeyRound, ArrowRight, User, Image as ImageIcon, Video, Globe, ShieldCheck, AlertTriangle, LogOut, CreditCard, Copy } from 'lucide-react';
import { ImageUploader, VideoUploader } from '@/components/ImageUploader';
import { Storyboard } from '@/components/Storyboard';
import { AnalysisLoader } from '@/components/AnalysisLoader';
import { analyzeProductAPI, validateGeminiConfigAPI } from '@/services/apiClient';
import { AppState, AspectRatio, VideoMode, StoryboardScene, ImageResolution, UserProfile, UserGeminiConfig } from '@/types';
import { ANALYSIS_MODELS, ASPECT_RATIOS, VIDEO_MODES, IMAGE_RESOLUTIONS, TARGET_MARKETS, IMAGE_MODELS, CAMERA_DEVICES, SHOOTING_STYLES } from '@/constants';
import { createClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/config';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AppClientProps {
  initialProfile: UserProfile;
}

const createInitialState = (): AppState => ({
  product: {
    images: [],
    title: '',
    description: '',
    creativeIdeas: '',
    targetMarket: 'US',
    modelImages: [],
    backgroundImages: [],
    referenceVideo: null,
  },
  settings: {
    aspectRatio: AspectRatio.Ratio_9_16,
    imageResolution: ImageResolution.Res_2K,
    videoMode: VideoMode.Standard,
    sceneCount: 1,
    analysisModel: 'gemini-2.5-flash',
    imageModel: 'gemini-3.0-pro-image',
    cameraDevice: 'iphone_16_pro_max',
    shootingStyle: 'fixed',
  },
  analysis: null,
  storyboard: [],
  isAnalyzing: false,
  isGeneratingScene: false,
  activeStep: 0,
});

export default function AppClient({ initialProfile }: AppClientProps) {
  const router = useRouter();
  const supabase = isDemoMode ? null : createClient();
  const riskLabelMap: Record<string, string> = {
    Safe: '安全',
    Warning: '注意',
    'High Risk': '高风险',
  };
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [geminiConfig, setGeminiConfig] = useState<UserGeminiConfig>({ apiKey: '', baseUrl: '' });
  const [isValidatingGemini, setIsValidatingGemini] = useState(false);
  const [geminiValidationMsg, setGeminiValidationMsg] = useState<string | null>(null);
  const [geminiValidated, setGeminiValidated] = useState(false);

  const [state, setState] = useState<AppState>(createInitialState);

  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishPanelOpen, setPublishPanelOpen] = useState(false);
  const [selectedPublishTags, setSelectedPublishTags] = useState<string[]>([]);

  const getRecommendedSceneCount = (durationSeconds?: number) => {
    const duration = Number(durationSeconds || 0);
    if (!duration) return 1;
    return Math.max(1, Math.min(6, Math.ceil(duration / 8)));
  };

  useEffect(() => {
    if (!state.analysis) {
      setSelectedPublishTags([]);
      return;
    }

    const tags = (state.analysis.primaryHashtags || [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .slice(0, 5);

    setSelectedPublishTags(tags);
    setPublishPanelOpen(false);
  }, [state.analysis]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('tk_gemini_config_v1');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setGeminiConfig({
        apiKey: String(parsed?.apiKey || ''),
        baseUrl: String(parsed?.baseUrl || ''),
      });
      setGeminiValidated(Boolean(parsed?.validated));
      setGeminiValidationMsg(parsed?.validated ? '已载入上次验证通过的 API 配置' : null);
    } catch {}
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
      return;
    }

    router.push('/');
  };

  const persistGeminiConfig = (nextConfig: UserGeminiConfig, validated: boolean) => {
    try {
      window.localStorage.setItem('tk_gemini_config_v1', JSON.stringify({
        apiKey: nextConfig.apiKey,
        baseUrl: nextConfig.baseUrl || '',
        validated,
      }));
    } catch {}
  };

  const handleProductUpdate = (field: string, value: any) => {
    setState(prev => {
      const nextProduct = { ...prev.product, [field]: value };
      const nextSettings = { ...prev.settings };

      if (field === 'referenceVideo') {
        nextSettings.sceneCount = value?.durationSeconds
          ? getRecommendedSceneCount(value.durationSeconds)
          : prev.settings.sceneCount;
      }

      return {
        ...prev,
        product: nextProduct,
        settings: nextSettings,
      };
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Copy failed', error);
      setErrorMsg('复制失败，请重试');
    }
  };

  const handleGeminiConfigChange = (field: keyof UserGeminiConfig, value: string) => {
    const nextConfig = { ...geminiConfig, [field]: value };
    setGeminiConfig(nextConfig);
    setGeminiValidated(false);
    setGeminiValidationMsg(null);
    persistGeminiConfig(nextConfig, false);
  };

  const validateGeminiConfig = async () => {
    if (!geminiConfig.apiKey.trim()) {
      setGeminiValidationMsg('请先输入 API Key');
      setGeminiValidated(false);
      return;
    }

    setIsValidatingGemini(true);
    setGeminiValidationMsg(null);
    try {
      const result = await validateGeminiConfigAPI(
        geminiConfig.apiKey.trim(),
        (geminiConfig.baseUrl || '').trim(),
        state.settings.analysisModel
      );
      setGeminiValidated(true);
      setGeminiValidationMsg(`验证成功：${result.providerLabel} / ${result.model}`);
      persistGeminiConfig({
        apiKey: geminiConfig.apiKey.trim(),
        baseUrl: (geminiConfig.baseUrl || '').trim(),
      }, true);
    } catch (error: any) {
      setGeminiValidated(false);
      setGeminiValidationMsg(error.message || 'API 验证失败');
      persistGeminiConfig(geminiConfig, false);
    } finally {
      setIsValidatingGemini(false);
    }
  };

  const buildPublishBundleText = () => {
    if (!state.analysis) return '';
    return [
      state.analysis.publishTitle,
      state.analysis.publishDescription,
      selectedPublishTags.join(' '),
    ].filter(Boolean).join('\n\n');
  };

  const togglePublishTag = (tag: string) => {
    const normalized = String(tag || '').trim();
    if (!normalized) return;

    setSelectedPublishTags((prev) => {
      if (prev.includes(normalized)) {
        return prev.filter((item) => item !== normalized);
      }

      if (prev.length < 5) {
        return [...prev, normalized];
      }
      return prev;
    });
  };

  const startAnalysis = async () => {
    if (state.product.images.length === 0) {
      setErrorMsg("请至少上传一张产品图片");
      return;
    }
    
    try {
        // @ts-ignore
        if (window.aistudio && window.aistudio.openSelectKey) {
             // @ts-ignore
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                 // @ts-ignore
                 await window.aistudio.openSelectKey();
            }
        }
    } catch(e) {}

    setState(prev => ({ ...prev, isAnalyzing: true, activeStep: 1 }));
    setErrorMsg(null);

    try {
      const { result, creditsRemaining } = await analyzeProductAPI(
        state.product,
        state.settings.sceneCount,
        state.settings.analysisModel,
        geminiConfig.apiKey.trim()
          ? { apiKey: geminiConfig.apiKey.trim(), baseUrl: (geminiConfig.baseUrl || '').trim() }
          : undefined
      );
      setProfile(prev => ({ ...prev, credits: creditsRemaining }));
      
      const initialStoryboard: StoryboardScene[] = result.scenes.map((s: any) => ({
        ...s,
        isGeneratingImage: false,
        isGeneratingAudio: false,
        isGeneratingStart: false,
        isGeneratingMiddle: false,
        isGeneratingEnd: false,
      }));
      
      const newSceneCount = result.scenes.length;

      setState(prev => ({
        ...prev,
        analysis: result,
        storyboard: initialStoryboard,
        isAnalyzing: false,
        settings: {
            ...prev.settings,
            sceneCount: newSceneCount
        }
      }));
    } catch (error: any) {
      console.error(error);
      let errMsg = error.message || "未知错误";
      
      if (typeof errMsg === 'string' && errMsg.includes('{')) {
          try {
              const jsonStart = errMsg.indexOf('{');
              const jsonEnd = errMsg.lastIndexOf('}') + 1;
              if (jsonStart !== -1 && jsonEnd !== -1) {
                  const jsonStr = errMsg.substring(jsonStart, jsonEnd);
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.error?.message) errMsg = parsed.error.message;
              }
          } catch(e) {}
      }

      if (errMsg.includes('429') || errMsg.includes('exhausted') || errMsg.includes('quota')) {
          errMsg = "API 配额已耗尽 (429)。请尝试更换 API Key 或稍后再试。系统已尝试切换备用模型，但仍无法完成请求。";
      }

      setErrorMsg(`分析失败: ${errMsg}`);
      setState(prev => ({ ...prev, isAnalyzing: false, activeStep: 0 }));
    }
  };

  const updateScene = (id: string, updates: Partial<StoryboardScene>) => {
    setState(prev => ({
      ...prev,
      storyboard: prev.storyboard.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const adjustSceneCount = (delta: number) => {
      setState(prev => ({
          ...prev,
          settings: {
              ...prev.settings,
              sceneCount: Math.max(0, Math.min(10, prev.settings.sceneCount + delta))
          }
      }));
  };

  return (
      <div className="min-h-screen pb-20 bg-dark-950 font-sans">
        {state.isAnalyzing && <AnalysisLoader mode="analysis" variant="fullscreen" />}
        
        <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-2 rounded-lg shadow-lg shadow-brand-900/50">
               <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-brand-400 to-white bg-clip-text text-transparent hidden sm:block">
              TikTok AI Creator Studio
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/billing" className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-700 rounded-full px-4 py-1.5 text-sm text-yellow-400 font-bold shadow-inner">
              <span className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 text-[10px]"><Sparkles size={8}/></span>
              {profile.credits} 点
            </Link>
            
            <div className="flex items-center gap-2 text-xs font-medium bg-slate-900 p-1 rounded-full border border-slate-800 hidden md:flex">
             <button 
                onClick={() => setState(prev => ({...prev, activeStep: 0}))}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all cursor-pointer ${state.activeStep === 0 ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <Settings2 size={14} /> 1. 产品设置
             </button>
             <ChevronRight size={14} className="text-slate-700" />
             <button 
                onClick={() => state.storyboard.length > 0 && setState(prev => ({...prev, activeStep: 1}))}
                disabled={state.storyboard.length === 0}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all ${state.activeStep === 1 ? 'bg-brand-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'} ${state.storyboard.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
             >
                <Layers size={14} /> 2. 智能分镜
             </button>
             <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 ml-2 transition-colors">
                 <LogOut size={14} />
             </button>
            </div>
          </div>
        </nav>

        <main className="pt-24 px-6 max-w-[1600px] mx-auto">
          
          {errorMsg && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4 shadow-lg shadow-red-900/10">
              <AlertCircle className="flex-shrink-0" />
              <span className="font-medium text-sm">{errorMsg}</span>
            </div>
          )}

          <div className={`${state.activeStep === 0 ? 'block' : 'hidden'} space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                  
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-3 text-white">
                    <KeyRound className="text-brand-500" size={20} />
                    分析 API / 模型
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">API Key</label>
                      <input
                        type="password"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="输入你自己的 Gemini / AI Studio API Key"
                        value={geminiConfig.apiKey}
                        onChange={(e) => handleGeminiConfigChange('apiKey', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Base URL <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="可选，自定义网关 / Vertex 兼容地址"
                        value={geminiConfig.baseUrl || ''}
                        onChange={(e) => handleGeminiConfigChange('baseUrl', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">分析模型</label>
                      <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-brand-500 outline-none"
                        value={state.settings.analysisModel}
                        onChange={(e) => setState(prev => ({ ...prev, settings: { ...prev.settings, analysisModel: e.target.value } }))}
                      >
                        {ANALYSIS_MODELS.map(model => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-500">如果当前模型失败，系统会从当前选择开始向后自动回退。</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={validateGeminiConfig}
                        disabled={isValidatingGemini}
                        className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                      >
                        {isValidatingGemini ? '验证中...' : '验证 API'}
                      </button>
                      <span className={`text-xs ${geminiValidated ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {geminiValidationMsg || '可填写你自己的 AI Studio Key；如有兼容 Base URL 也可一起填写。'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                  
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-3 text-white">
                    <LayoutTemplate className="text-brand-500" size={20} /> 
                    产品信息
                  </h2>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-brand-400 uppercase mb-1.5 flex items-center gap-2">
                            <Globe size={14} /> 目标市场 / Target Market
                        </label>
                        <select 
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-brand-500 outline-none"
                            value={state.product.targetMarket}
                            onChange={(e) => handleProductUpdate('targetMarket', e.target.value)}
                        >
                            {TARGET_MARKETS.map(m => (
                                <option key={m.value} value={m.value} disabled={m.disabled}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                     </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">产品标题 <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="例如：亚马逊爆款无叶挂脖风扇..."
                        value={state.product.title}
                        onChange={(e) => handleProductUpdate('title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">产品描述 / 卖点 <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <textarea 
                        rows={4}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="粘贴亚马逊五点描述或用户评论..."
                        value={state.product.description}
                        onChange={(e) => handleProductUpdate('description', e.target.value)}
                      />
                    </div>
                     <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">创意想法 <span className="text-slate-600 text-[10px] ml-1">(可选)</span></label>
                      <textarea 
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none text-slate-200 placeholder-slate-700 transition-all"
                        placeholder="例如：希望是高能反转剧情，或者沉浸式ASMR风格..."
                        value={state.product.creativeIdeas}
                        onChange={(e) => handleProductUpdate('creativeIdeas', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-3 text-white">
                    <Settings2 className="text-brand-500" size={20} /> 
                    视频参数
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">画面比例</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                value={state.settings.aspectRatio}
                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, aspectRatio: e.target.value as AspectRatio}}))}
                            >
                                {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">生成模式</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                value={state.settings.videoMode}
                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, videoMode: e.target.value as VideoMode}}))}
                            >
                                {VIDEO_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    
                        {/* Image Model Selection RESTORED */}
                        <div className="col-span-1">
                             <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">生图模型 (Model)</label>
                             <select 
                                 className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                 value={state.settings.imageModel}
                                 onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, imageModel: e.target.value}}))}
                             >
                                 {IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                             </select>
                        </div>

                        {/* Resolution Selection */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">分辨率</label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                value={state.settings.imageResolution}
                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, imageResolution: e.target.value as ImageResolution}}))}
                            >
                                {IMAGE_RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        {/* Camera Device Selection - New */}
                        <div>
                             <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">拍摄设备</label>
                             <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                value={state.settings.cameraDevice}
                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, cameraDevice: e.target.value}}))}
                            >
                                {CAMERA_DEVICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>

                        {/* Shooting Style Selection - New */}
                        <div>
                             <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">拍摄风格</label>
                             <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-brand-500 outline-none"
                                value={state.settings.shootingStyle}
                                onChange={(e) => setState(prev => ({...prev, settings: {...prev.settings, shootingStyle: e.target.value}}))}
                            >
                                {SHOOTING_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                                分镜数量 {state.product.referenceVideo && <span className="text-brand-500 normal-case ml-1 text-[10px]">(可调整)</span>}
                            </label>
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1 h-[38px]">
                                    <button 
                                        onClick={() => adjustSceneCount(-1)}
                                        className="w-8 h-full rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="flex-1 text-center text-brand-400 font-bold text-sm">
                                        {state.settings.sceneCount === 0 ? '自动 (Auto)' : state.settings.sceneCount}
                                    </span>
                                    <button 
                                        onClick={() => adjustSceneCount(1)}
                                        className="w-8 h-full rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                            </div>
                            {state.product.referenceVideo?.durationSeconds ? (
                              <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
                                参考视频约 {state.product.referenceVideo.durationSeconds.toFixed(1)} 秒，当前按 Veo 3.1 单条约 8 秒自动建议
                                {' '}
                                {getRecommendedSceneCount(state.product.referenceVideo.durationSeconds)} 个镜头。
                              </p>
                            ) : null}
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl h-full flex flex-col relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                  
                  <div className="mb-8">
                     <h2 className="text-xl font-bold mb-4 text-white flex justify-between items-center">
                        <span className="flex items-center gap-2"><ImageIcon size={20} className="text-brand-500"/> 产品素材</span>
                        <span className="text-xs text-slate-500 font-normal">建议上传 4-8 张</span>
                     </h2>
                     <div className="h-32">
                        <ImageUploader 
                            images={state.product.images} 
                            onImagesChange={(imgs) => handleProductUpdate('images', imgs)} 
                            onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                            maxImages={8}
                            gridCols={8}
                            compact={true}
                        />
                     </div>
                  </div>
                  
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-t border-slate-800 pt-8">
                      <div>
                          <div className="flex items-center gap-2 mb-3">
                              <User size={18} className="text-blue-400" />
                              <h3 className="text-sm font-bold text-slate-200">指定模特 <span className="text-xs font-normal text-slate-500 ml-1">(可选)</span></h3>
                          </div>
                          <p className="text-xs text-slate-500 mb-3 h-8">上传1-4张模特图，提取特征用于所有镜头。</p>
                          <div className="h-24">
                            <ImageUploader 
                                images={state.product.modelImages} 
                                onImagesChange={(imgs) => handleProductUpdate('modelImages', imgs)} 
                                onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                                maxImages={4}
                                gridCols={4}
                                compact={true}
                            />
                          </div>
                      </div>

                      <div>
                          <div className="flex items-center gap-2 mb-3">
                              <ImageIcon size={18} className="text-purple-400" />
                              <h3 className="text-sm font-bold text-slate-200">指定背景 <span className="text-xs font-normal text-slate-500 ml-1">(可选)</span></h3>
                          </div>
                           <p className="text-xs text-slate-500 mb-3 h-8">上传1-2张背景图，统一视频场景风格。</p>
                          <div className="h-24">
                            <ImageUploader 
                                images={state.product.backgroundImages} 
                                onImagesChange={(imgs) => handleProductUpdate('backgroundImages', imgs)} 
                                onPreview={(url) => setPreviewMedia({url, type: 'image'})}
                                maxImages={2}
                                gridCols={2}
                                compact={true}
                            />
                          </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Video size={18} className="text-green-400" />
                            <h3 className="text-sm font-bold text-slate-200">参考视频 <span className="text-xs font-normal text-slate-500 ml-1">(可选)</span></h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 h-8">分析视频节奏、风格，自动匹配分镜。</p>
                        <div className="h-24">
                            <VideoUploader 
                                video={state.product.referenceVideo}
                                onVideoChange={(v) => handleProductUpdate('referenceVideo', v)}
                            />
                        </div>
                       </div>
                   </div>

                  <div className="mt-auto pt-6">
                      <button 
                       onClick={startAnalysis}
                       disabled={state.isAnalyzing}
                       className="w-full py-5 bg-gradient-to-r from-brand-600 via-brand-500 to-blue-600 hover:from-brand-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-brand-900/40 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed group"
                     >
                        <BrainCircuit size={24} className="group-hover:animate-pulse" /> 
                        <span className="text-lg tracking-wide">启动 AI 智能创作流</span>
                     </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className={`${state.activeStep === 1 ? 'block' : 'hidden'} animate-in fade-in slide-in-from-right-8 duration-500`}>
             <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-[350px] flex-shrink-0 space-y-6">
                   <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 sticky top-28 shadow-2xl space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                           <Bot className="text-brand-500" /> 专家团队分析报告
                        </h2>
                      </div>
                      
                      {state.analysis && (
                        <div className="space-y-6 text-sm">
                           <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
                              <button
                                onClick={() => setPublishPanelOpen((prev) => !prev)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-900/70 transition-colors"
                              >
                                <div>
                                  <h3 className="text-slate-200 font-bold text-sm">TikTok 发布包</h3>
                                  <p className="text-slate-500 text-[11px] mt-1">标题、描述、主推标签和备选标签</p>
                                </div>
                                {publishPanelOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                              </button>

                              {publishPanelOpen && (
                                <div className="px-4 pb-4 space-y-4 border-t border-slate-800">
                                  <div className="pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-[11px] font-bold text-brand-400 uppercase">主推标签</h4>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => copyToClipboard(selectedPublishTags.join(' '))}
                                          className="text-[10px] bg-brand-600/20 hover:bg-brand-500 text-brand-300 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-brand-500/20"
                                        >
                                          <Copy size={10} /> 复制标签
                                        </button>
                                        <button
                                          onClick={() => copyToClipboard(buildPublishBundleText())}
                                          className="text-[10px] bg-sky-600/20 hover:bg-sky-500 text-sky-300 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-sky-500/20"
                                        >
                                          <Copy size={10} /> 复制标题+描述+标签
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedPublishTags.map((tag) => (
                                        <button
                                          key={tag}
                                          onClick={() => togglePublishTag(tag)}
                                          className="px-2.5 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs hover:bg-brand-500/25 transition-colors"
                                        >
                                          {tag} <span className="ml-1 text-slate-400">x</span>
                                        </button>
                                      ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">默认保持 5 个标签。你可以单独删除；删除后再从备选里补一个，也可以少于 5 个直接使用。</p>
                                  </div>

                                  <div>
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">备选标签</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {(state.analysis.backupHashtags || []).map((tag) => {
                                        const active = selectedPublishTags.includes(tag);
                                        return (
                                          <button
                                            key={tag}
                                            onClick={() => togglePublishTag(tag)}
                                            className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                                              active
                                                ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                                            }`}
                                          >
                                            {tag}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-[11px] font-bold text-amber-400 uppercase">发布标题</h4>
                                      <button
                                        onClick={() => copyToClipboard(state.analysis.publishTitle)}
                                        className="text-[10px] bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-amber-500/20"
                                      >
                                        <Copy size={10} /> 复制
                                      </button>
                                    </div>
                                    <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                                      {state.analysis.publishTitle}
                                    </p>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-[11px] font-bold text-emerald-400 uppercase">发布描述</h4>
                                      <button
                                        onClick={() => copyToClipboard(state.analysis.publishDescription)}
                                        className="text-[10px] bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-emerald-500/20"
                                      >
                                        <Copy size={10} /> 复制
                                      </button>
                                    </div>
                                    <p className="text-slate-300 text-xs leading-relaxed bg-slate-900/80 border border-slate-800 rounded-lg p-3 whitespace-pre-wrap">
                                      {state.analysis.publishDescription}
                                    </p>
                                  </div>
                                </div>
                              )}
                           </div>

                           <div className={`p-4 rounded-lg border ${state.analysis.complianceCheck.riskLevel === 'Safe' ? 'bg-green-900/10 border-green-500/30' : 'bg-orange-900/10 border-orange-500/30'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    {state.analysis.complianceCheck.riskLevel === 'Safe' ? (
                                        <ShieldCheck className="text-green-500" size={18} />
                                    ) : (
                                        <AlertTriangle className="text-orange-500" size={18} />
                                    )}
                                    <h3 className={`font-bold text-xs ${state.analysis.complianceCheck.riskLevel === 'Safe' ? 'text-green-400' : 'text-orange-400'}`}>
                                        TikTok 合规与文化检查
                                    </h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-slate-950/50 p-2 rounded">
                                        <span className="text-xs text-slate-400 block mb-1 font-bold">风险等级</span>
                                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${state.analysis.complianceCheck.riskLevel === 'Safe' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                            {riskLabelMap[state.analysis.complianceCheck.riskLevel] || state.analysis.complianceCheck.riskLevel}
                                        </span>
                                    </div>
                                    <p className="text-slate-300 text-xs leading-relaxed">{state.analysis.complianceCheck.report}</p>
                                    <div className="border-t border-slate-700/50 pt-2">
                                        <span className="text-[10px] font-bold text-slate-500 block mb-1">文化合规建议</span>
                                        <p className="text-slate-400 text-xs italic">"{state.analysis.complianceCheck.culturalNotes}"</p>
                                    </div>
                                </div>
                           </div>

                           <div className="bg-brand-900/20 p-4 rounded-lg border border-brand-500/20">
                              <h3 className="text-brand-400 font-bold text-xs mb-2 flex items-center gap-1">🎯 核心策略</h3>
                              <p className="text-slate-200 leading-relaxed font-medium">{state.analysis.strategy}</p>
                           </div>

                           <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                              <h3 className="text-slate-300 font-bold text-xs mb-2">📦 产品识别</h3>
                              <p className="text-slate-300 text-xs leading-relaxed mb-2">{state.analysis.productType}</p>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.productSpecs}</p>
                           </div>
                            
                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">🎣 强钩子</h3>
                              <p className="text-white italic bg-slate-950 p-2 rounded border border-slate-800">"{state.analysis.hook}"</p>
                            </div>

                            <div>
                                <h3 className="text-slate-500 font-bold text-xs mb-1">👥 目标受众</h3>
                                <p className="text-slate-300 text-xs">{state.analysis.targetAudience}</p>
                            </div>
                           
                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">💡 卖点提炼</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.sellingPoints}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">😣 核心痛点</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.painPoints}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">🧍 模特要求</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.modelRequirements}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">🧩 素材匹配策略</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.assetMatchingGuidance}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">🏡 背景策略</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.backgroundGuidance}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">📸 真实度策略</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.realismGuidance}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">🎬 参考视频拆解</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.referenceVideoAnalysis}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">📝 参考视频脚本与画面提取</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.referenceVideoScriptExtraction}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">✍️ 参考视频重塑策略</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.referenceVideoRewrite}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">🧭 结构保留与替换计划</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.referenceVideoStructurePlan}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">⏱️ 时长重塑计划</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.referenceVideoTimingPlan}</p>
                           </div>

                           <div>
                              <h3 className="text-slate-500 font-bold text-xs mb-1">✅ Harness 检查结论</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.referenceVideoHarnessCheck}</p>
                           </div>

                           <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                              <h3 className="text-slate-300 font-bold text-xs mb-2">🧱 Harness 执行约束</h3>
                              <p className="text-slate-400 text-xs leading-relaxed">{state.analysis.executionHarness}</p>
                           </div>
                        </div>
                      )}
                   </div>
                </div>

                <div className="flex-1 space-y-6">
                   <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur">
                     <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-white">分镜脚本</h2>
                        <span className="text-xs px-2 py-1 bg-brand-900/50 text-brand-300 rounded border border-brand-500/30">
                            共 {state.storyboard.length} 个镜头
                        </span>
                     </div>
                     <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-400">当前模式</span>
                        <div className="text-sm px-3 py-1 bg-slate-800 rounded-full text-white border border-slate-700 font-medium shadow-sm">
                           {VIDEO_MODES.find(m => m.value === state.settings.videoMode)?.label}
                        </div>
                     </div>
                   </div>

                   <Storyboard 
                     scenes={state.storyboard} 
                     videoMode={state.settings.videoMode}
                     aspectRatio={state.settings.aspectRatio}
                     resolution={state.settings.imageResolution}
                     imageModel={state.settings.imageModel}
                     cameraDevice={state.settings.cameraDevice}
                     shootingStyle={state.settings.shootingStyle}
                     productImages={state.product.images}
                     modelImages={state.product.modelImages}
                     backgroundImages={state.product.backgroundImages}
                     assignedVoice={state.analysis?.assignedVoice || 'Kore'}
                     onUpdateScene={updateScene}
                     onPreview={(url, type) => setPreviewMedia({url, type})}
                     productTitle={state.product.title}
                   />
                </div>
             </div>
          </div>
        </main>

        {previewMedia && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setPreviewMedia(null)}>
             <button className="absolute top-6 right-6 text-white hover:text-brand-500 p-2 transition-colors">
               <X size={40} />
             </button>
             <div className="max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-slate-800 bg-black relative" onClick={e => e.stopPropagation()}>
               {previewMedia.type === 'image' ? (
                 <img src={previewMedia.url} className="max-h-[85vh] w-auto object-contain mx-auto" />
               ) : (
                 <div className="bg-black p-4 rounded-xl">
                    <video src={previewMedia.url} controls className="max-h-[85vh] max-w-[85vw]" />
                 </div>
               )}
              </div>
           </div>
        )}
      </div>
  );
}
