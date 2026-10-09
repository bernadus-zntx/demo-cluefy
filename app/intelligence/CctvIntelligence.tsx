"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./cctv-intelligence.module.css";

type CameraStatus = "active" | "inactive" | "connecting" | "standby";

type Camera = {
  id: string;
  name: string;
  status: CameraStatus;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  playerUrl: string;
  sourceUrl: string;
  provider: string;
  note: string;
};

const officialStreamingUrl = "https://atcs.denpasarkota.go.id/streaming";
const hlsLibraryUrl = "https://cdn.jsdelivr.net/npm/hls.js@1.4.10";

type HlsPlayer = {
  loadSource: (source: string) => void;
  attachMedia: (video: HTMLVideoElement) => void;
  on: (event: string, callback: (event: string, data: { fatal?: boolean }) => void) => void;
  destroy: () => void;
};

type HlsConstructor = {
  new (config?: Record<string, unknown>): HlsPlayer;
  isSupported: () => boolean;
  Events: { MANIFEST_PARSED: string; ERROR: string };
};

declare global {
  interface Window { Hls?: HlsConstructor }
}

// A light demo subset from the official 110-camera ATCS directory.
const cameras: Camera[] = [
  { id:"A001-GUNUNG-AGUNG",name:"Simpang Gunung Agung",status:"active",latitude:-8.6554,longitude:115.1955,city:"Denpasar Barat",region:"Kota Denpasar",country:"Indonesia",playerUrl:"https://atcs.denpasarkota.go.id/stream/A001GUNUNGAGUNGPTZ/",sourceUrl:officialStreamingUrl,provider:"ATCS Kota Denpasar",note:"Simpang Wahidin – Gunung Agung" },
  { id:"A002-KAPTEN-SUJANA",name:"Simpang Kapten Sujana",status:"active",latitude:-8.6368,longitude:115.1947,city:"Denpasar Barat",region:"Kota Denpasar",country:"Indonesia",playerUrl:"https://atcs.denpasarkota.go.id/stream/A002KAPTENSUJANAPTZ/",sourceUrl:officialStreamingUrl,provider:"ATCS Kota Denpasar",note:"Simpang Buluh Indah – Gunung Agung" },
  { id:"A003-GUNUNG-SALAK",name:"Simpang Gunung Salak",status:"active",latitude:-8.6742,longitude:115.1807,city:"Denpasar Barat",region:"Kota Denpasar",country:"Indonesia",playerUrl:"https://atcs.denpasarkota.go.id/stream/A003GUNUNGSALAKPTZ/",sourceUrl:officialStreamingUrl,provider:"ATCS Kota Denpasar",note:"Simpang Teuku Umar Barat – Gunung Salak" },
  { id:"A004-TEUKU-UMAR",name:"Simpang Teuku Umar 1",status:"active",latitude:-8.6832,longitude:115.1976,city:"Denpasar Barat",region:"Kota Denpasar",country:"Indonesia",playerUrl:"https://atcs.denpasarkota.go.id/stream/A004TEUKUUMARPTZ1/",sourceUrl:officialStreamingUrl,provider:"ATCS Kota Denpasar",note:"Simpang Imam Bonjol – Teuku Umar" },
  { id:"A005-BATANTA",name:"Simpang Batanta",status:"active",latitude:-8.6847,longitude:115.1933,city:"Denpasar Barat",region:"Kota Denpasar",country:"Indonesia",playerUrl:"https://atcs.denpasarkota.go.id/stream/A005BATANTAPTZ/",sourceUrl:officialStreamingUrl,provider:"ATCS Kota Denpasar",note:"Simpang Teuku Umar – Batanta" },
  { id:"A006-SOPUTAN",name:"Simpang Soputan",status:"active",latitude:-8.6970,longitude:115.1905,city:"Denpasar Barat",region:"Kota Denpasar",country:"Indonesia",playerUrl:"https://atcs.denpasarkota.go.id/stream/A006SOPUTANPTZ/",sourceUrl:officialStreamingUrl,provider:"ATCS Kota Denpasar",note:"Simpang Imam Bonjol – Gunung Soputan" },
];

const statusLabels: Record<CameraStatus, string> = {
  active: "Live tersedia",
  inactive: "Tidak tersedia",
  connecting: "Menghubungkan",
  standby: "Standby",
};

function mapPosition(camera: Camera) {
  const left = Math.min(91, Math.max(9, ((camera.longitude - 115.17) / .045) * 78 + 10));
  const top = Math.min(88, Math.max(12, ((-8.625 - camera.latitude) / .08) * 72 + 10));
  return { left:`${left}%`,top:`${top}%` };
}

let hlsLibraryPromise: Promise<HlsConstructor> | null = null;

function loadHlsLibrary(): Promise<HlsConstructor> {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsLibraryPromise) return hlsLibraryPromise;
  hlsLibraryPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${hlsLibraryUrl}"]`);
    const script = existing ?? document.createElement("script");
    const handleLoad = () => window.Hls ? resolve(window.Hls) : reject(new Error("HLS library unavailable"));
    script.addEventListener("load", handleLoad, { once:true });
    script.addEventListener("error", () => reject(new Error("HLS library failed to load")), { once:true });
    if (!existing) {
      script.src = hlsLibraryUrl;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return hlsLibraryPromise;
}

function LiveCctvPlayer({ camera, reloadKey }: { camera: Camera; reloadKey: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "error">("loading");

  useEffect(() => {
    const currentMedia = videoRef.current;
    if (!currentMedia) return;
    const media: HTMLVideoElement = currentMedia;
    let disposed = false;
    let hls: HlsPlayer | null = null;
    const manifestUrl = `${camera.playerUrl}index.m3u8`;
    setState("loading");

    async function start() {
      try {
        if (media.canPlayType("application/vnd.apple.mpegurl")) {
          media.src = manifestUrl;
          await media.play();
          if (!disposed) setState("playing");
          return;
        }
        const Hls = await loadHlsLibrary();
        if (disposed || !Hls.isSupported()) throw new Error("HLS unsupported");
        hls = new Hls({ maxLiveSyncPlaybackRate:1.5 });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          media.play().then(() => { if (!disposed) setState("playing"); }).catch(() => { if (!disposed) setState("error"); });
        });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal && !disposed) setState("error"); });
        hls.loadSource(manifestUrl);
        hls.attachMedia(media);
      } catch {
        if (!disposed) setState("error");
      }
    }

    void start();
    return () => {
      disposed = true;
      hls?.destroy();
      media.pause();
      media.removeAttribute("src");
      media.load();
    };
  }, [camera, reloadKey]);

  return <div className={styles.livePlayer}>
    <video ref={videoRef} muted autoPlay playsInline controls aria-label={`Live CCTV ${camera.name}`} />
    <div className={styles.liveOverlay}><span><i/> OFFICIAL LIVE</span><small>{camera.id}</small></div>
    {state === "loading" && <div className={styles.playerState}><span className={styles.spinner}/><b>Menghubungkan live stream…</b></div>}
    {state === "error" && <div className={styles.playerState}><b>Stream tidak dapat dimuat di dashboard</b><a href={camera.playerUrl} target="_blank" rel="noreferrer">Buka player resmi ↗</a></div>}
  </div>;
}

export function CctvIntelligence() {
  const [tab, setTab] = useState<"monitor" | "connection">("monitor");
  const [filter, setFilter] = useState<"all" | CameraStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(cameras[0].id);
  const [playerKey, setPlayerKey] = useState(0);

  const selected = cameras.find(camera => camera.id === selectedId) ?? cameras[0];
  const filtered = useMemo(() => cameras.filter(camera => {
    const matchesStatus = filter === "all" || camera.status === filter;
    const searchable = `${camera.name} ${camera.city} ${camera.note}`.toLocaleLowerCase("id-ID");
    return matchesStatus && searchable.includes(query.trim().toLocaleLowerCase("id-ID"));
  }), [filter, query]);
  const online = cameras.filter(camera => camera.status === "active").length;

  function selectCamera(id: string) {
    setSelectedId(id);
    setPlayerKey(key => key + 1);
  }

  return <>
    <div className={styles.hero}>
      <div><span>CCTV & TRAFFIC INTELLIGENCE</span><h2>Live CCTV Kota Denpasar</h2><p>Sumber pembanding terdekat untuk demo ClueFy Kabupaten Badung, langsung dari ATCS resmi.</p></div>
      <div className={`${styles.modeBadge} ${styles.live}`}><i/>LIVE · PUBLIC STREAM</div>
    </div>

    <div className={styles.tabs} role="tablist" aria-label="CCTV views">
      <button className={tab === "monitor" ? styles.activeTab : ""} onClick={() => setTab("monitor")}>◉ Monitor CCTV</button>
      <button className={tab === "connection" ? styles.activeTab : ""} onClick={() => setTab("connection")}>⇄ Status Integrasi</button>
    </div>

    {tab === "monitor" ? <>
      <div className={styles.kpis}>
        <article><small>Kamera Demo</small><strong>{cameras.length}</strong><p>Dipilih dari direktori resmi</p></article>
        <article className={styles.onlineKpi}><small>Live Tersedia</small><strong>{online}</strong><p>Public stream ATCS</p></article>
        <article><small>Direktori Resmi</small><strong>110</strong><p>CCTV Kota Denpasar</p></article>
        <article><small>Provider Aktif</small><strong>ATCS</strong><p>Dishub Kota Denpasar</p></article>
      </div>

      <div className={styles.monitorGrid}>
        <section className={styles.viewer}>
          <div className={styles.viewerTop}>
            <div><span>SELECTED LIVE CAMERA</span><h3>{selected.name}</h3><p>{selected.city}, {selected.region} · {selected.provider}</p></div>
            <span className={`${styles.status} ${styles[selected.status]}`}><i/>{statusLabels[selected.status]}</span>
          </div>
          <LiveCctvPlayer camera={selected} reloadKey={playerKey}/>
          <div className={styles.viewerFooter}>
            <div><span>LOKASI</span><b>{selected.note}</b></div>
            <div><span>AKSES</span><b>Live stream publik · tanpa API key</b></div>
            <div className={styles.viewerActions}><button onClick={() => setPlayerKey(key => key + 1)}>↻ Muat Ulang</button><a href={selected.playerUrl} target="_blank" rel="noreferrer">Buka Player Resmi ↗</a></div>
          </div>
        </section>

        <section className={styles.mapCard}>
          <div className={styles.sectionTitle}><div><h3>Peta Kamera Demo</h3><p>Enam titik live di wilayah Kota Denpasar</p></div><span>{cameras.length} titik</span></div>
          <div className={styles.map}>
            <span className={styles.coast}>KOTA<br/><b>DENPASAR</b></span>
            <i className={styles.roadOne}/><i className={styles.roadTwo}/>
            {cameras.map((camera,index) => <button key={camera.id} className={`${styles.mapMarker} ${styles[camera.status]} ${selected.id === camera.id ? styles.selectedMarker : ""}`} style={mapPosition(camera)} onClick={() => selectCamera(camera.id)} aria-label={`Pilih ${camera.name}`}><span>{index+1}</span><small>{camera.name.replace("Simpang ","")}</small></button>)}
          </div>
          <div className={styles.mapLegend}><span><i className={styles.active}/>Live tersedia</span><span><i className={styles.connecting}/>Menghubungkan</span><span><i className={styles.inactive}/>Tidak tersedia</span></div>
        </section>
      </div>

      <section className={styles.directory}>
        <div className={styles.directoryHead}><div><h3>Direktori CCTV Demo</h3><p>Klik kamera untuk mengganti live player di atas.</p></div><div className={styles.tools}><label>⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari kamera atau lokasi…"/></label><select value={filter} onChange={event => setFilter(event.target.value as "all" | CameraStatus)}><option value="all">Semua status</option><option value="active">Live tersedia</option><option value="inactive">Tidak tersedia</option><option value="connecting">Menghubungkan</option><option value="standby">Standby</option></select></div></div>
        <div className={styles.listHead}><span>KAMERA / LOKASI</span><span>PROVIDER</span><span>STATUS</span><span>WILAYAH</span><span/></div>
        {filtered.map(camera => <button className={`${styles.cameraRow} ${selected.id === camera.id ? styles.selectedRow : ""}`} key={camera.id} onClick={() => selectCamera(camera.id)}><span><i>◉</i><b>{camera.name}<small>{camera.note}</small></b></span><span>{camera.provider}</span><span className={`${styles.rowStatus} ${styles[camera.status]}`}><i/>{statusLabels[camera.status]}</span><span>{camera.city}</span><span>Watch →</span></button>)}
        {!filtered.length && <p className={styles.empty}>Tidak ada kamera yang sesuai dengan filter.</p>}
      </section>
    </> : <div className={styles.connectionGrid}>
      <section className={styles.connectionCard}>
        <div className={styles.connectionTitle}><span className={`${styles.baliIcon} ${styles.connectedIcon}`}>D</span><div><h3>ATCS Kota Denpasar</h3><p>Live streaming publik resmi Dinas Perhubungan Kota Denpasar.</p></div><span className={`${styles.connectionPill} ${styles.connectedPill}`}>LIVE SOURCE</span></div>
        <div className={styles.connectionFacts}><div><small>DIRECTORY</small><b>110 CCTV terpasang</b></div><div><small>AUTHENTICATION</small><b>Tidak memerlukan API key</b></div><div><small>INTEGRATION</small><b>Official HLS live stream</b></div><div><small>OWNER</small><b>Dishub Kota Denpasar</b></div></div>
        <div className={styles.connectionMessage}><span>✓</span><p><b>Sumber live siap dipakai untuk demo.</b> ClueFy membuka player resmi ATCS pada kamera yang dipilih. Ketersediaan video mengikuti layanan milik provider.</p></div>
        <div className={styles.connectionActions}><a className={styles.primaryLink} href={officialStreamingUrl} target="_blank" rel="noreferrer">Buka 110 Kamera ↗</a><a href={selected.playerUrl} target="_blank" rel="noreferrer">Tes Kamera Terpilih ↗</a></div>
      </section>

      <section className={styles.connectionCard}>
        <div className={styles.connectionTitle}><span className={styles.scopeIcon}>i</span><div><h3>Cakupan Demo</h3><p>Pemisahan wilayah dan sumber data ditampilkan secara eksplisit.</p></div><span className={`${styles.connectionPill} ${styles.publicPill}`}>DENPASAR</span></div>
        <div className={styles.connectionFacts}><div><small>WORKSPACE</small><b>Kabupaten Badung</b></div><div><small>LIVE PROVIDER</small><b>Kota Denpasar</b></div><div><small>USE IN DEMO</small><b>Nearby traffic reference</b></div><div><small>BADUNG LIVE</small><b>Menunggu akses resmi</b></div></div>
        <div className={styles.connectionMessage}><span>i</span><p><b>Tidak diklaim sebagai kamera Badung.</b> Kamera Denpasar dipakai sebagai contoh integrasi live. Saat akses Dishub Badung tersedia, provider dapat ditambahkan tanpa mengubah pengalaman pengguna.</p></div>
      </section>
    </div>}

    <div className={styles.sourceNote}><span>i</span><p><b>Sumber resmi.</b> Video ditayangkan dari public live player ATCS Kota Denpasar. Enam kamera dipilih untuk menjaga demo tetap ringan; direktori lengkap menyediakan 110 titik. Status dan kontinuitas tayangan mengikuti layanan Dishub Kota Denpasar.</p></div>
  </>;
}
