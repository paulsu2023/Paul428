import { NextRequest, NextResponse } from 'next/server';

function buildFileName(rawName: string | null, fallbackContentType: string | null) {
  const trimmed = (rawName || '').trim();
  if (trimmed) return trimmed;

  if (fallbackContentType?.includes('video/mp4')) return 'media.mp4';
  if (fallbackContentType?.includes('image/png')) return 'media.png';
  if (fallbackContentType?.includes('image/')) return 'media.jpg';
  if (fallbackContentType?.includes('audio/wav')) return 'media.wav';

  return 'media.bin';
}

function pickHeader(upstream: Response, header: string) {
  const value = upstream.headers.get(header);
  return value ? { [header]: value } : {};
}

async function proxyMedia(request: NextRequest, method: 'GET' | 'HEAD') {
  const url = request.nextUrl.searchParams.get('url');
  const filename = request.nextUrl.searchParams.get('filename');
  const download = request.nextUrl.searchParams.get('download') === '1';

  if (!url) {
    return NextResponse.json({ error: '缺少媒体地址' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: '媒体地址无效' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: '仅支持 http/https 媒体地址' }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      method,
      cache: 'no-store',
      headers: request.headers.get('range')
        ? { Range: request.headers.get('range') as string }
        : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: '拉取媒体失败' }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const resolvedName = buildFileName(filename, contentType);
    const dispositionType = download ? 'attachment' : 'inline';

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `${dispositionType}; filename*=UTF-8''${encodeURIComponent(resolvedName)}`,
      'Cache-Control': 'no-store',
      ...pickHeader(upstream, 'accept-ranges'),
      ...pickHeader(upstream, 'content-length'),
      ...pickHeader(upstream, 'content-range'),
      ...pickHeader(upstream, 'etag'),
      ...pickHeader(upstream, 'last-modified'),
    });

    return new NextResponse(method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('[API/media] Error:', error);
    return NextResponse.json({ error: '媒体代理失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return proxyMedia(request, 'GET');
}

export async function HEAD(request: NextRequest) {
  return proxyMedia(request, 'HEAD');
}
