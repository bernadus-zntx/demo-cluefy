import { NextResponse } from "next/server";

type WindyWebcam = {
  webcamId?: number;
  status?: "active" | "inactive";
  title?: string;
  lastUpdatedOn?: string;
  images?: {
    current?: Record<string, string | undefined>;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    region?: string;
    country?: string;
  };
  player?: {
    live?: string;
    day?: string;
  };
  urls?: {
    detail?: string;
    desktop?: string;
  };
};

type WindyResponse = {
  webcams?: WindyWebcam[];
  total?: number;
};

const WINDY_ENDPOINT = "https://api.windy.com/webcams/api/v3/webcams";

function currentImage(webcam: WindyWebcam): string | null {
  const images = webcam.images?.current;
  if (!images) return null;
  return images.preview ?? images.thumbnail ?? images.icon ?? images.full ?? Object.values(images).find(Boolean) ?? null;
}

export async function GET() {
  const apiKey = process.env.WINDY_WEBCAMS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      provider: "Windy Webcams API",
      message: "WINDY_WEBCAMS_API_KEY belum dikonfigurasi. Menampilkan titik ATCS demo.",
      cameras: [],
    });
  }

  const query = new URLSearchParams({
    nearby: "-8.65,115.17,60",
    include: "images,location,player,urls,categories",
    limit: "50",
    lang: "id",
  });

  try {
    const response = await fetch(`${WINDY_ENDPOINT}?${query}`, {
      headers: { "x-windy-api-key": apiKey },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        connected: false,
        provider: "Windy Webcams API",
        message: `Windy API merespons HTTP ${response.status}. Titik demo tetap ditampilkan.`,
        cameras: [],
      });
    }

    const payload = await response.json() as WindyResponse;
    const cameras = (payload.webcams ?? []).map(webcam => ({
      id: String(webcam.webcamId ?? crypto.randomUUID()),
      name: webcam.title ?? "Webcam tanpa nama",
      status: webcam.status ?? "inactive",
      latitude: webcam.location?.latitude ?? null,
      longitude: webcam.location?.longitude ?? null,
      city: webcam.location?.city ?? "Badung dan sekitarnya",
      region: webcam.location?.region ?? "Bali",
      country: webcam.location?.country ?? "Indonesia",
      previewUrl: currentImage(webcam),
      playerUrl: webcam.player?.live ?? webcam.player?.day ?? null,
      sourceUrl: webcam.urls?.detail ?? webcam.urls?.desktop ?? null,
      lastUpdatedAt: webcam.lastUpdatedOn ?? null,
    }));

    return NextResponse.json({
      configured: true,
      connected: true,
      provider: "Windy Webcams API",
      attribution: "Webcams provided by Windy.com",
      total: payload.total ?? cameras.length,
      cameras,
    });
  } catch {
    return NextResponse.json({
      configured: true,
      connected: false,
      provider: "Windy Webcams API",
      message: "Windy API tidak dapat dijangkau. Titik demo tetap ditampilkan.",
      cameras: [],
    });
  }
}
