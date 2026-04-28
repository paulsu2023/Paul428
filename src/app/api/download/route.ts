import { NextRequest, NextResponse } from 'next/server';

function buildDownloadName(rawName: string | null, fallbackContentType: string | null) {
  const trimmed = (rawName || '').trim();
  if (trimmed) {
    return trimmed;
  }

  if (fallbackContentType?.includes('video/mp4')) {
    return 'download.mp4';
  }

  if (fallbackContentType?.includes('image/png')) {
    return 'download.png';
  }

  if (fallbackContentType?.includes('image/')) {
    return 'download.jpg';
  }

  return 'download.bin';
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const filename = request.nextUrl.searchParams.get('filename');

  if (!url) {
    return NextResponse.json({ error: '缺少下载地址' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: '下载地址无效' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: '仅支持 http/https 下载地址' }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json({ error: '拉取文件失败' }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const downloadName = buildDownloadName(filename, contentType);
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[API/download] Error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
