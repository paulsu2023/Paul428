"use client";

import React, { useRef } from 'react';
import { Upload, X, Maximize2, Video } from 'lucide-react';
import { ReferenceVideoData } from '@/types';

interface Props {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onPreview: (img: string) => void;
  maxImages?: number;
  gridCols?: number;
  label?: string;
  compact?: boolean; // If true, shows grid immediately instead of large dropzone
}

export const ImageUploader: React.FC<Props> = ({ 
    images, 
    onImagesChange, 
    onPreview, 
    maxImages = 8, 
    gridCols = 8, 
    label,
    compact = true 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB per image
    const files = Array.from(e.target.files).filter(file => {
      if (file.size > MAX_IMAGE_SIZE) {
        alert(`图片 "${file.name}" 超过 10MB 限制，已跳过。请压缩后重新上传。`);
        return false;
      }
      return true;
    });
    if (files.length === 0) return;

    // Fix: Use Promise.all to avoid race condition from concurrent FileReader callbacks
    const readAsBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    Promise.all(files.map(readAsBase64)).then(newImages => {
      onImagesChange([...images, ...newImages].slice(0, maxImages));
    });
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newImgs = [...images];
    newImgs.splice(index, 1);
    onImagesChange(newImgs);
  };

  const showLargeDropzone = !compact && images.length === 0;

  return (
    <div className="w-full flex flex-col h-full">
      {label && <div className="text-xs font-bold text-slate-500 uppercase mb-2">{label} <span className="text-slate-600 font-normal">({images.length}/{maxImages})</span></div>}
      
      {showLargeDropzone ? (
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 border-2 border-dashed border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors bg-slate-800/50 group min-h-[120px]"
        >
            <div className="bg-slate-700 p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-brand-500" />
            </div>
            <p className="text-slate-300 font-medium text-sm">点击上传</p>
            <p className="text-slate-500 text-xs mt-1">JPG, PNG</p>
        </div>
      ) : (
        <div className={`grid gap-2 h-full ${gridCols === 8 ? 'grid-cols-8' : gridCols === 4 ? 'grid-cols-4' : 'grid-cols-4'}`}>
          {Array.from({ length: maxImages }).map((_, idx) => {
            const img = images[idx];
            return (
                <div 
                    key={idx} 
                    className={`aspect-square relative group rounded-md overflow-hidden border border-slate-700 bg-black/50 ${!img ? 'border-dashed border-slate-700/50 hover:border-slate-500 cursor-pointer' : ''}`}
                    onClick={() => !img && fileInputRef.current?.click()}
                >
                {img ? (
                    <>
                    <img 
                        src={`data:image/jpeg;base64,${img}`} 
                        alt={`Upload ${idx}`} 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 backdrop-blur-sm z-10">
                        <button 
                        onClick={(e) => { e.stopPropagation(); onPreview(`data:image/jpeg;base64,${img}`); }}
                        className="p-1 bg-brand-600 hover:bg-brand-500 rounded text-white shadow-lg"
                        >
                        <Maximize2 size={10} />
                        </button>
                        <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        className="p-1 bg-red-500/90 hover:bg-red-500 rounded text-white shadow-lg"
                        >
                        <X size={10} />
                        </button>
                    </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full w-full hover:bg-slate-800/50 transition-colors">
                        <Upload className="text-slate-700 w-4 h-4" />
                    </div>
                )}
                </div>
            );
          })}
        </div>
      )}

      <input 
        type="file" 
        multiple 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange}
      />
    </div>
  );
};

interface VideoProps {
    video: ReferenceVideoData | null | undefined;
    onVideoChange: (video: ReferenceVideoData | null) => void;
    label?: string;
}

export const VideoUploader: React.FC<VideoProps> = ({ video, onVideoChange, label }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const extractVideoFrames = (file: File): Promise<ReferenceVideoData> => new Promise((resolve, reject) => {
        const previewUrl = URL.createObjectURL(file);
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        videoEl.src = previewUrl;
        videoEl.muted = true;
        videoEl.playsInline = true;

        let finished = false;

        const cleanup = () => {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
        };

        const fail = (error: unknown) => {
            if (finished) return;
            finished = true;
            URL.revokeObjectURL(previewUrl);
            cleanup();
            reject(error instanceof Error ? error : new Error('参考视频解析失败'));
        };

        const captureFrameAt = (time: number) => new Promise<string>((resolveFrame, rejectFrame) => {
            const canvas = document.createElement('canvas');
            canvas.width = videoEl.videoWidth || 720;
            canvas.height = videoEl.videoHeight || 1280;

            const onSeeked = () => {
                try {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('无法创建视频帧画布');
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                    resolveFrame(jpegDataUrl.split(',')[1]);
                } catch (error) {
                    rejectFrame(error);
                } finally {
                    videoEl.removeEventListener('seeked', onSeeked);
                }
            };

            videoEl.addEventListener('seeked', onSeeked, { once: true });
            videoEl.currentTime = Math.max(0, Math.min(time, Math.max((videoEl.duration || 0) - 0.1, 0)));
        });

        videoEl.onloadedmetadata = async () => {
            try {
                const duration = Math.max(videoEl.duration || 0, 0.1);
                const samplePoints = Array.from(new Set([
                    0,
                    Math.min(duration * 0.25, Math.max(duration - 0.1, 0)),
                    Math.min(duration * 0.5, Math.max(duration - 0.1, 0)),
                    Math.min(duration * 0.8, Math.max(duration - 0.1, 0)),
                ]));

                const analysisFrames: string[] = [];
                for (const point of samplePoints) {
                    analysisFrames.push(await captureFrameAt(point));
                }

                if (finished) return;
                finished = true;

                resolve({
                    previewUrl,
                    mimeType: file.type || 'video/mp4',
                    fileName: file.name,
                    sizeBytes: file.size,
                    durationSeconds: Number(duration.toFixed(2)),
                    width: videoEl.videoWidth || 0,
                    height: videoEl.videoHeight || 0,
                    analysisFrames,
                });
                cleanup();
            } catch (error) {
                fail(error);
            }
        };

        videoEl.onerror = () => fail(new Error('参考视频读取失败'));
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit
        if (file.size > MAX_VIDEO_SIZE) {
            alert(`视频文件 "${file.name}" 超过 50MB 限制。请使用压缩工具压缩后重新上传。`);
            e.target.value = '';
            return;
        }

        try {
            if (video?.previewUrl) {
                URL.revokeObjectURL(video.previewUrl);
            }
            const parsedVideo = await extractVideoFrames(file);
            onVideoChange(parsedVideo);
        } catch (error) {
            console.error('[VideoUploader] parse failed', error);
            alert(`参考视频解析失败：${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            e.target.value = '';
        }
    };

    return (
        <div className="w-full flex flex-col h-full">
             {label && <div className="text-xs font-bold text-slate-500 uppercase mb-2">{label}</div>}
             
             <div 
                onClick={() => !video && fileInputRef.current?.click()}
                className={`relative w-full h-full min-h-[100px] border border-slate-700 rounded-xl overflow-hidden bg-black/50 ${!video ? 'border-dashed cursor-pointer hover:border-brand-500 hover:bg-slate-800/50' : ''}`}
             >
                 {video ? (
                    <div className="relative w-full h-full group">
                        <video 
                            src={video.previewUrl}
                            className="w-full h-full object-cover"
                            controls={false}
                            muted
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm z-10">
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (video.previewUrl) {
                                        URL.revokeObjectURL(video.previewUrl);
                                    }
                                    onVideoChange(null);
                                }}
                                className="px-3 py-1.5 bg-red-500/90 hover:bg-red-500 rounded text-white text-xs font-bold flex items-center gap-2 shadow-lg"
                            >
                                <X size={14} /> Remove Video
                            </button>
                        </div>
                        <div className="absolute top-2 right-2 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded shadow">
                            REF
                        </div>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                        <div className="bg-slate-800 p-2 rounded-full">
                            <Video size={18} className="text-slate-400" />
                        </div>
                        <span className="text-xs">上传参考视频 (MP4)</span>
                    </div>
                 )}
             </div>

             <input 
                type="file" 
                accept="video/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
            />
        </div>
    )
}
