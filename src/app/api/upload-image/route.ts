import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'Upload de imagens não configurado. Adicione IMGBB_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Envie uma imagem no campo "image".' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo não permitido. Use JPEG, PNG, GIF ou WebP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Imagem muito grande. Máximo 5MB.' },
        { status: 400 }
      );
    }

    const imgbbFormData = new FormData();
    imgbbFormData.append('image', file);

    const res = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        body: imgbbFormData,
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      const msg =
        data?.error?.message ?? data?.error ?? `ImgBB retornou ${res.status}`;
      return NextResponse.json(
        { error: `Falha no upload: ${msg}` },
        { status: 502 }
      );
    }

    const url = data?.data?.url ?? data?.data?.image?.url;
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Resposta inválida do ImgBB.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ url });
  } catch (e) {
    console.error('upload-image:', e);
    return NextResponse.json(
      { error: 'Erro ao fazer upload da imagem.' },
      { status: 500 }
    );
  }
}
