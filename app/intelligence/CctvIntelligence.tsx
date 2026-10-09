"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./cctv-intelligence.module.css";

type CameraStatus = "active" | "inactive" | "connecting" | "standby";

type Camera = {
  id: string;
  name: string;
  status: CameraStatus;
  latitude: number | null;
  longitude: number | null;
  city: string;
  region: string;
  country: string;
  previewUrl: string | null;
  playerUrl: string | null;
  sourceUrl: string | null;
  lastUpdatedAt: string | null;
  provider?: string;
  note?: string;
};

type ApiResponse = {
  configured: boolean;
  connected?: boolean;
  provider: string;
  attribution?: string;
  message?: string;
  total?: number;
  cameras: Camera[];
};

const officialMapUrl = "https://balisatudata.baliprov.go.id/peta-cctv";

const demoCameras: Camera[] = [
  { id:"ATCS-BALI-001",name:"Simpang 3 Patung Kuda",status:"active",latitude:-8.7484,longitude:115.1772,city:"Kuta",region:"Badung",country:"Indonesia",previewUrl:"/demo-kuta-traffic.svg",playerUrl:null,sourceUrl:officialMapUrl,lastUpdatedAt:"2026-10-09T10:04:00+08:00",provider:"ATCS Dishub Bali",note:"Akses menuju Bandara I Gusti Ngurah Rai" },
  { id:"ATCS-BALI-002",name:"Simpang 3 Kedonganan",status:"active",latitude:-8.7627,longitude:115.1777,city:"Kuta",region:"Badung",country:"Indonesia",previewUrl:"/demo-kuta-traffic.svg",playerUrl:null,sourceUrl:officialMapUrl,lastUpdatedAt:"2026-10-09T10:03:00+08:00",provider:"ATCS Dishub Bali",note:"Koridor By Pass Ngurah Rai" },
  { id:"ATCS-BALI-003",name:"Simpang 4 Unud Jimbaran",status:"connecting",latitude:-8.7916,longitude:115.1728,city:"Kuta Selatan",region:"Badung",country:"Indonesia",previewUrl:"/demo-kuta-traffic.svg",playerUrl:null,sourceUrl:officialMapUrl,lastUpdatedAt:"2026-10-09T09:58:00+08:00",provider:"ATCS Dishub Bali",note:"Akses Jimbaran dan Kampus Unud" },
  { id:"ATCS-BALI-004",name:"Simpang 3 Taman Griya",status:"active",latitude:-8.7939,longitude:115.1921,city:"Kuta Selatan",region:"Badung",country:"Indonesia",previewUrl:"/demo-kuta-traffic.svg",playerUrl:null,sourceUrl:officialMapUrl,lastUpdatedAt:"2026-10-09T10:02:00+08:00",provider:"ATCS Dishub Bali",note:"Akses permukiman dan Nusa Dua" },
  { id:"ATCS-BALI-005",name:"Simpang 3 Tol Nusa Dua",status:"standby",latitude:-8.7968,longitude:115.2077,city:"Kuta Selatan",region:"Badung",country:"Indonesia",previewUrl:"/demo-kuta-traffic.svg",playerUrl:null,sourceUrl:officialMapUrl,lastUpdatedAt:"2026-10-09T09:45:00+08:00",provider:"ATCS Dishub Bali",note:"Gerbang kawasan Nusa Dua" },
  { id:"ATCS-BALI-006",name:"Simpang 4 Tanjung Benoa",status:"inactive",latitude:-8.7805,longitude:115.2207,city:"Kuta Selatan",region:"Badung",country:"Indonesia",previewUrl:"/demo-kuta-traffic.svg",playerUrl:null,sourceUrl:officialMapUrl,lastUpdatedAt:"2026-10-09T08:34:00+08:00",provider:"ATCS Dishub Bali",note:"Koneksi terakhir terputus" },
];

const statusLabels: Record<CameraStatus, string> = {
  active: "Online",
  inactive: "Offline / Error",
  connecting: "Connecting",
  standby: "Standby",
};

async function requestCameras(): Promise<ApiResponse> {
  const response = await fetch("/api/cctv", { cache:"no-store" });
  return response.json() as Promise<ApiResponse>;
}

function formatTime(value: string | null): string {
  if (!value) return "Belum tersedia";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit" }).format(date);
}

function mapPosition(camera: Camera) {
  const latitude = camera.latitude ?? -8.78;
  const longitude = camera.longitude ?? 115.19;
  const left = Math.min(92, Math.max(8, ((longitude - 115.15) / .09) * 84 + 8));
  const top = Math.min(88, Math.max(12, ((-8.73 - latitude) / .09) * 72 + 12));
  return { left:`${left}%`,top:`${top}%` };
}

export function CctvIntelligence() {
  const [tab, setTab] = useState<"monitor" | "connection">("monitor");
  const [filter, setFilter] = useState<"all" | CameraStatus>("all");
  const [query, setQuery] = useState("");
  const [api, setApi] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(demoCameras[0].id);

  async function loadCameras() {
    setLoading(true);
    try {
      const data = await requestCameras();
      setApi(data);
      if (data.cameras.length) setSelectedId(data.cameras[0].id);
    } catch {
      setApi({ configured:false,connected:false,provider:"Windy Webcams API",message:"Endpoint integrasi belum dapat dijangkau.",cameras:[] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    requestCameras()
      .then(data => {
        if (!active) return;
        setApi(data);
        if (data.cameras.length) setSelectedId(data.cameras[0].id);
      })
      .catch(() => {
        if (active) setApi({ configured:false,connected:false,provider:"Windy Webcams API",message:"Endpoint integrasi belum dapat dijangkau.",cameras:[] });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const liveCameras = api?.connected && api.cameras.length ? api.cameras : demoCameras;
  const selected = liveCameras.find(camera => camera.id === selectedId) ?? liveCameras[0];
  const filtered = useMemo(() => liveCameras.filter(camera => {
    const matchesStatus = filter === "all" || camera.status === filter;
    const searchable = `${camera.name} ${camera.city} ${camera.note ?? ""}`.toLocaleLowerCase("id-ID");
    return matchesStatus && searchable.includes(query.trim().toLocaleLowerCase("id-ID"));
  }), [filter, liveCameras, query]);
  const online = liveCameras.filter(camera => camera.status === "active").length;
  const issues = liveCameras.filter(camera => camera.status === "inactive" || camera.status === "connecting").length;
  const isLive = Boolean(api?.connected && api.cameras.length);

  return <>
    <div className={styles.hero}>
      <div><span>CCTV & TRAFFIC INTELLIGENCE</span><h2>Pemantauan Visual Kabupaten Badung</h2><p>Pantau titik kamera, kesehatan koneksi, dan konteks lalu lintas dari satu layar.</p></div>
      <div className={`${styles.modeBadge} ${isLive ? styles.live : ""}`}><i/>{isLive ? "LIVE API" : "DEMO · API READY"}</div>
    </div>

    <div className={styles.tabs} role="tablist" aria-label="CCTV views">
      <button className={tab === "monitor" ? styles.activeTab : ""} onClick={() => setTab("monitor")}>◉ Monitor CCTV</button>
      <button className={tab === "connection" ? styles.activeTab : ""} onClick={() => setTab("connection")}>⇄ Status Integrasi</button>
    </div>

    {tab === "monitor" ? <>
      <div className={styles.kpis}>
        <article><small>Titik Terpantau</small><strong>{liveCameras.length}</strong><p>{isLive ? "Dari respons API terkini" : "Titik ATCS untuk demo"}</p></article>
        <article className={styles.onlineKpi}><small>Kamera Online</small><strong>{online}</strong><p>{Math.round(online / liveCameras.length * 100)}% tersedia</p></article>
        <article className={issues ? styles.alertKpi : ""}><small>Perlu Perhatian</small><strong>{issues}</strong><p>Offline atau connecting</p></article>
        <article><small>Provider Aktif</small><strong>{isLive ? "Windy" : "ATCS Bali"}</strong><p>{isLive ? "Webcams API V3" : "Public point reference"}</p></article>
      </div>

      <div className={styles.monitorGrid}>
        <section className={styles.viewer}>
          <div className={styles.viewerTop}>
            <div><span>SELECTED CAMERA</span><h3>{selected.name}</h3><p>{selected.city}, {selected.region} · {selected.provider ?? api?.provider}</p></div>
            <span className={`${styles.status} ${styles[selected.status]}`}><i/>{statusLabels[selected.status]}</span>
          </div>
          <div className={styles.cameraFrame} style={{backgroundImage:`linear-gradient(180deg,transparent 55%,rgba(4,28,32,.76)),url(${selected.previewUrl ?? "/demo-kuta-traffic.svg"})`}} role="img" aria-label={`Pratinjau ${selected.name}`}>
            <div className={styles.frameMeta}><span><i/> {statusLabels[selected.status]}</span><time>{formatTime(selected.lastUpdatedAt)} WITA</time></div>
            <div className={styles.frameLabel}><small>{selected.id}</small><strong>{selected.note ?? "Live webcam preview"}</strong></div>
          </div>
          <div className={styles.viewerFooter}>
            <div><span>LOKASI</span><b>{selected.latitude?.toFixed(4) ?? "—"}, {selected.longitude?.toFixed(4) ?? "—"}</b></div>
            <div><span>LAST UPDATE</span><b>{formatTime(selected.lastUpdatedAt)}</b></div>
            <a href={selected.playerUrl ?? selected.sourceUrl ?? officialMapUrl} target="_blank" rel="noreferrer">{selected.playerUrl ? "Buka Live Player" : "Buka Sumber Resmi"} ↗</a>
          </div>
        </section>

        <section className={styles.mapCard}>
          <div className={styles.sectionTitle}><div><h3>Peta Kamera</h3><p>Badung Selatan dan koridor By Pass Ngurah Rai</p></div><span>{liveCameras.length} titik</span></div>
          <div className={styles.map}>
            <span className={styles.coast}>BADUNG<br/><b>SELATAN</b></span>
            <i className={styles.roadOne}/><i className={styles.roadTwo}/>
            {liveCameras.map((camera,index) => <button key={camera.id} className={`${styles.mapMarker} ${styles[camera.status]} ${selected.id === camera.id ? styles.selectedMarker : ""}`} style={mapPosition(camera)} onClick={() => setSelectedId(camera.id)} aria-label={`Pilih ${camera.name}`}><span>{index+1}</span><small>{camera.name.replace("Simpang ","")}</small></button>)}
          </div>
          <div className={styles.mapLegend}><span><i className={styles.active}/>Online</span><span><i className={styles.connecting}/>Connecting</span><span><i className={styles.standby}/>Standby</span><span><i className={styles.inactive}/>Offline</span></div>
        </section>
      </div>

      <section className={styles.directory}>
        <div className={styles.directoryHead}><div><h3>Direktori CCTV</h3><p>Pilih kamera untuk membuka preview dan detail sumber.</p></div><div className={styles.tools}><label>⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari lokasi kamera…"/></label><select value={filter} onChange={event => setFilter(event.target.value as "all" | CameraStatus)}><option value="all">Semua status</option><option value="active">Online</option><option value="inactive">Offline</option><option value="connecting">Connecting</option><option value="standby">Standby</option></select></div></div>
        <div className={styles.listHead}><span>KAMERA / LOKASI</span><span>PROVIDER</span><span>STATUS</span><span>UPDATE TERAKHIR</span><span/></div>
        {filtered.map(camera => <button className={`${styles.cameraRow} ${selected.id === camera.id ? styles.selectedRow : ""}`} key={camera.id} onClick={() => setSelectedId(camera.id)}><span><i>◉</i><b>{camera.name}<small>{camera.city} · {camera.note}</small></b></span><span>{camera.provider ?? api?.provider}</span><span className={`${styles.rowStatus} ${styles[camera.status]}`}><i/>{statusLabels[camera.status]}</span><span>{formatTime(camera.lastUpdatedAt)}</span><span>View →</span></button>)}
        {!filtered.length && <p className={styles.empty}>Tidak ada kamera yang sesuai dengan filter.</p>}
      </section>
    </> : <div className={styles.connectionGrid}>
      <section className={styles.connectionCard}>
        <div className={styles.connectionTitle}><span className={`${styles.providerIcon} ${isLive ? styles.connectedIcon : ""}`}>W</span><div><h3>Windy Webcams API</h3><p>Provider webcam publik untuk area Badung dan sekitarnya.</p></div><span className={`${styles.connectionPill} ${isLive ? styles.connectedPill : ""}`}>{loading ? "CHECKING" : isLive ? "CONNECTED" : api?.configured ? "CONNECTION ERROR" : "KEY REQUIRED"}</span></div>
        <div className={styles.connectionFacts}><div><small>ENDPOINT</small><b>/webcams/api/v3/webcams</b></div><div><small>AUTHENTICATION</small><b>Server-side API key</b></div><div><small>CACHE</small><b>5 minutes</b></div><div><small>AREA</small><b>Radius 60 km · Badung</b></div></div>
        <div className={styles.connectionMessage}><span>i</span><p><b>{api?.message ?? (isLive ? "Koneksi API aktif dan data kamera berhasil dimuat." : "Memeriksa koneksi API…")}</b>{!isLive && " Tambahkan WINDY_WEBCAMS_API_KEY pada environment deployment untuk mengaktifkan data live."}</p></div>
        <div className={styles.connectionActions}><button onClick={() => void loadCameras()} disabled={loading}>{loading ? "Memeriksa…" : "↻ Test Connection"}</button><a href="https://api.windy.com/webcams/docs" target="_blank" rel="noreferrer">Dokumentasi API ↗</a></div>
      </section>

      <section className={styles.connectionCard}>
        <div className={styles.connectionTitle}><span className={styles.baliIcon}>B</span><div><h3>Bali Satu Data · Peta CCTV</h3><p>Portal publik resmi Pemerintah Provinsi Bali.</p></div><span className={`${styles.connectionPill} ${styles.publicPill}`}>PUBLIC PORTAL</span></div>
        <div className={styles.connectionFacts}><div><small>DATA</small><b>Status dan sebaran CCTV</b></div><div><small>ACCESS</small><b>Public web portal</b></div><div><small>API STATUS</small><b>Credential resmi diperlukan</b></div><div><small>OWNER</small><b>Diskominfos Bali</b></div></div>
        <div className={styles.connectionMessage}><span>✓</span><p><b>Siap menjadi provider resmi.</b> Adapter ClueFy dapat diarahkan ke endpoint Bali Satu Data setelah akses API diberikan oleh Diskominfos atau Dishub.</p></div>
        <div className={styles.connectionActions}><a className={styles.primaryLink} href={officialMapUrl} target="_blank" rel="noreferrer">Buka Peta CCTV ↗</a><a href="https://dishub.baliprov.go.id/sistem-atcs-dinas-perhubungan-provinsi-bali/" target="_blank" rel="noreferrer">Daftar ATCS ↗</a></div>
      </section>
    </div>}

    <div className={styles.sourceNote}><span>i</span><p><b>Sumber dan batasan.</b> Titik demo mengikuti daftar lokasi ATCS yang dipublikasikan Dishub Provinsi Bali. Preview lokal hanya untuk demonstrasi UI. Ketika API key Windy aktif, ClueFy akan memakai metadata dan URL yang dikembalikan API serta menampilkan atribusi provider.</p></div>
  </>;
}
