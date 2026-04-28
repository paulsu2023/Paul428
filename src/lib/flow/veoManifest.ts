type SceneLike = {
  title?: string;
  visual?: string;
  visual_en?: string;
  action?: string;
  action_en?: string;
  camera?: string;
  camera_en?: string;
  dialogue?: string;
};

type VoiceOptions = {
  voiceName?: string;
  voiceProfile?: string;
};

function normalizeText(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function guessShotType(cameraText: string) {
  const text = cameraText.toLowerCase();
  if (text.includes('close')) return 'Close-up';
  if (text.includes('medium')) return 'Medium shot';
  if (text.includes('wide')) return 'Wide shot';
  if (text.includes('macro')) return 'Macro';
  return 'Medium close-up';
}

function guessAngle(cameraText: string) {
  const text = cameraText.toLowerCase();
  if (text.includes('low')) return 'Low angle';
  if (text.includes('high')) return 'High angle';
  if (text.includes('top')) return 'Top-down';
  if (text.includes('side')) return 'Side angle';
  return 'Eye level';
}

function guessSpeed(cameraText: string, actionText: string) {
  const text = `${cameraText} ${actionText}`.toLowerCase();
  if (text.includes('fast') || text.includes('quick') || text.includes('rapid')) return 'Fast';
  if (text.includes('slow') || text.includes('gentle') || text.includes('smooth')) return 'Slow';
  return 'Controlled';
}

function buildPositiveMandate(visual: string, action: string) {
  const summary = normalizeText(`${visual} ${action}`).slice(0, 220);
  return summary
    ? `Preserve the exact subject identity, wardrobe, lighting continuity, and environment realism while executing: ${summary}.`
    : 'Preserve the exact subject identity, wardrobe, lighting continuity, and environment realism throughout the shot.';
}

function buildOrientationLockMandate() {
  return 'Keep the subject primarily front-facing or in a stable three-quarter angle. Preserve the visible product orientation from the start frame and avoid revealing unsupported back-side details.';
}

function buildBackgroundAction(visual: string) {
  return normalizeText(
    `Maintain a premium, coherent background with realistic depth, stable lighting, and physically plausible motion while supporting this shot: ${visual}.`
  );
}

function buildAmbient(visual: string) {
  const text = visual.toLowerCase();
  if (text.includes('beach') || text.includes('ocean') || text.includes('sea')) {
    return 'Natural ocean ambience, light wind, and soft shoreline movement.';
  }
  if (text.includes('bedroom') || text.includes('living room') || text.includes('home')) {
    return 'Clean indoor room tone with soft environmental ambience.';
  }
  return 'Authentic location ambience with no distracting spikes or glitches.';
}

function buildMood(action: string) {
  const text = action.toLowerCase();
  if (text.includes('shocked')) return 'Shocked, Immediate, Reactive';
  if (text.includes('excited') || text.includes('energetic')) return 'Excited, High Energy, Authentic';
  if (text.includes('urgent')) return 'Urgent, Persuasive, Direct';
  return 'Engaging, Authentic, Conversion-focused';
}

export function buildVeoProductionManifest(scene: SceneLike) {
  return buildVeoProductionManifestWithVoice(scene);
}

export function buildVeoProductionManifestWithVoice(scene: SceneLike, options: VoiceOptions = {}) {
  const visual = normalizeText(scene.visual_en || scene.visual) || 'A premium TikTok UGC product scene with a realistic subject.';
  const action = normalizeText(scene.action_en || scene.action) || 'The subject demonstrates the product naturally with stable, realistic motion.';
  const camera = normalizeText(scene.camera_en || scene.camera) || 'Medium close-up with controlled natural movement.';
  const dialogue = normalizeText(scene.dialogue);
  const shotSummary = normalizeText(scene.title) || visual.slice(0, 120);
  const voiceMandate = options.voiceName
    ? `Maintain the same speaker identity, vocal timbre, age impression, and delivery energy established for ${options.voiceName}${options.voiceProfile ? ` (${options.voiceProfile})` : ''} across the full storyboard.`
    : 'Maintain the same speaker identity, vocal timbre, age impression, and delivery energy across the full storyboard.';

  const manifest = {
    veo_production_manifest: {
      version: '4.0',
      shot_summary: shotSummary,
      description: 'The ultimate industrial-grade production manifest. V4.0.',
      global_settings: {
        input_assets: {
          reference_image: 'Start Frame',
        },
        output_specifications: {
          resolution: '1080p',
          aspect_ratio_lock: {
            enabled: true,
            comment: 'Forces all elements and actions to respect the intended aspect ratio.',
          },
          color_space: 'Rec. 2020',
          dynamic_range: 'HDR',
        },
        rendering_pipeline: {
          engine: 'Physically-Based Rendering (PBR)',
          light_transport: 'Path Tracing',
          shadow_quality: 'High-resolution shadow maps',
        },
      },
      director_mandates: {
        positive_mandates: [
          'The video MUST start with the provided start frame.',
          'Maintenance of texture, lighting, and resolution from the start frame is critical at 0s, 2s, 4s, and 6s.',
          voiceMandate,
          buildOrientationLockMandate(),
          buildPositiveMandate(visual, action),
        ],
        negative_mandates: [
          'NO smooth or stable camera motion if action is chaotic.',
          'NO morphing of character features.',
          'NO lowering of resolution or quality.',
          'NO full body turn-away, NO back-facing reveal, NO large rotation that changes the visible product side.',
          'NO invented back details, NO unsupported rear view, NO product orientation swap between frames.',
          'NO mirrors, NO shooting into a mirror, NO selfies in mirror, NO phone visible in hand.',
          'NO flicker, exposure pumping, texture crawling, frame popping, or impossible physics.',
        ],
      },
      aesthetic_filter: {
        name: 'Social Media UGC Realism',
        visual_mandates: {
          lighting_style: 'Front-facing Ring Light / Natural',
          atmosphere: 'High Energy, Immediate, Authentic',
          style_description: 'User Generated Content (UGC) style, TikTok/Reels aesthetic',
          color_palette: 'Matches start frame, realistic skin tones',
        },
        performance_mandates: {
          mood: buildMood(action),
          physics_engine: 'Hyper-realistic',
        },
      },
      timeline_script: [
        {
          time_start: '0.0s',
          time_end: '8.0s',
          description: visual,
          elements: {
            visuals: {
              subject_action: action,
              background_action: buildBackgroundAction(visual),
              consistency_check: 'At 0s, 2s, 4s, 6s: Ensure absolute consistency in lighting, resolution, and character appearance with the start frame. Do not lower resolution.',
            },
            camera: {
              shot_composition: {
                shot_type: guessShotType(camera),
                angle: guessAngle(camera),
              },
              camera_movement: {
                primary_movement: camera,
                movement_description: 'Camera motion must feel intentional, physically plausible, and stable without flicker or abrupt jumps.',
                speed: guessSpeed(camera, action),
              },
            },
            audio_scape: {
              dialogue: {
                transcript: dialogue,
              },
              sfx: ['Subtle cloth movement', 'Natural environmental detail'],
              ambient: buildAmbient(visual),
            },
            overlays_and_graphics: [],
          },
        },
      ],
    },
  };

  return JSON.stringify(manifest, null, 2);
}
