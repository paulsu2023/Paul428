import { NextRequest, NextResponse } from 'next/server';
import { createGoogleClient } from '@/lib/google/client';
import { GEMINI_MODEL_ANALYSIS } from '@/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = String(body?.apiKey || '').trim();
    const baseUrl = String(body?.baseUrl || '').trim();
    const model = String(body?.model || GEMINI_MODEL_ANALYSIS).trim();

    if (!apiKey) {
      return NextResponse.json({ error: '请输入 API Key' }, { status: 400 });
    }

    const client = createGoogleClient({
      apiKey,
      baseUrl,
    });

    await client.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: 'Reply with: ok' }],
      }],
    });

    return NextResponse.json({
      ok: true,
      providerLabel: baseUrl ? 'Custom/Vertex-Compatible' : 'Google AI Studio',
      model,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'API 验证失败' },
      { status: 500 }
    );
  }
}
