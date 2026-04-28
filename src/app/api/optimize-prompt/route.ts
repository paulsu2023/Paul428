import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGoogleClient } from '@/lib/google/client';
import { shouldUseSupabase } from '@/lib/config';
import { GEMINI_MODEL_ANALYSIS } from '@/constants';

export async function POST(request: NextRequest) {
  try {
    if (shouldUseSupabase) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
      }
    }

    const { currentPrompt, visualDesc, masterPrompt } = await request.json();

    const systemInstruction = `You are an expert AI prompt engineer (Midjourney v6 & Veo style).

Task: Optimize the user's image prompt.

Directives:
1. CRITICAL: CHARACTER CONSISTENCY. If Master Reference exists, extract the age, ethnicity, hair style, outfit, and visual identity cues from it and force them into the new prompt.
2. STYLE: HYPER-REALISM. Use tags: "Raw photo, 8k, highly detailed skin texture, soft lighting, film grain, shot on Sony A7R".
3. UGC REALISM. Add: "raw candid photo, shot on iPhone, authentic amateur footage, clean aesthetic home background, premium interior, skin texture, visible pores, film grain".
4. STRICT VISUAL CONSISTENCY: Follow the person's face, features, and the environment EXACTLY as shown in the provided reference images.
5. SINGLE-FRAME COMPOSITION ONLY. Explicitly force: "single coherent frame, single-scene composition, no collage, no split screen, no storyboard grid, no duplicate subject".
6. NEGATIVE CONSTRAINTS: Explicitly avoid: "3d render, cartoon, plastic skin, smooth face, artificial, collage, split screen, diptych, triptych, storyboard layout, contact sheet, mosaic, tiled composition".
7. ABSOLUTELY NO WAREHOUSES, FACTORIES, or INDUSTRIAL backgrounds unless specifically requested by the context.
8. Return ONLY the raw prompt string. No markdown. No explanations.`;

    const promptText = `
Master Character Reference (MUST MATCH THIS PERSON EXACTLY): ${masterPrompt || 'None'}
Visual Description: ${visualDesc}
Current Prompt: ${currentPrompt}
Produce a concise but descriptive English image prompt with premium TikTok realism, single-frame composition, and explicit negative constraints.`;

    const genai = createGoogleClient();
    const response = await genai.models.generateContent({
      model: GEMINI_MODEL_ANALYSIS,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: { systemInstruction }
    });

    const optimized = response.text || currentPrompt;

    return NextResponse.json({ optimized });
  } catch (error: any) {
    console.error('[API/optimize-prompt] Error:', error);
    return NextResponse.json({ error: error.message || '优化失败' }, { status: 500 });
  }
}
