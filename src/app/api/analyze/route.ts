import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CREDIT_COSTS } from '@/constants';
import { createGoogleClient } from '@/lib/google/client';
import { shouldUseSupabase } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    let userId: string | null = null;
    let creditsRemaining = 0;

    if (shouldUseSupabase) {
      supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
      }

      userId = user.id;

      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', {
          p_user_id: user.id,
          p_amount: CREDIT_COSTS.ANALYZE,
          p_type: 'analyze',
          p_description: '产品分析 & 脚本生成',
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

    const body = await request.json();
    const { product, sceneCount, analysisModel, geminiConfig } = body;

    // === All Gemini logic runs SERVER SIDE, API key never leaves server ===
    const { analyzeProduct } = await import('@/lib/gemini/geminiService');
    const genai = createGoogleClient({
      apiKey: geminiConfig?.apiKey,
      baseUrl: geminiConfig?.baseUrl,
    });
    
    let result;
    try {
      result = await analyzeProduct(genai, product, sceneCount, analysisModel);
    } catch (aiError: any) {
      if (supabase && userId) {
        await supabase.rpc('add_credits', {
          p_user_id: userId,
          p_amount: CREDIT_COSTS.ANALYZE,
          p_type: 'refund',
          p_description: '分析失败自动退还'
        });
      }
      throw aiError;
    }

    return NextResponse.json({
      result,
      creditsRemaining,
    });
  } catch (error: any) {
    console.error('[API/analyze] Error:', error);
    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}
