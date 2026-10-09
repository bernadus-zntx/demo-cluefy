"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ara-assistant.module.css";

type Message = {
  role: "ara" | "user";
  text: string;
};

type PageContext = {
  label: string;
  intro: string;
  suggestions: string[];
  answer: string;
};

const defaultContext: PageContext = {
  label: "ClueFy Intelligence",
  intro: "Saya siap membantu membaca data dan menemukan hal yang perlu ditindaklanjuti.",
  suggestions: ["Ringkas situasi hari ini", "Apa yang perlu diperhatikan?", "Tunjukkan rekomendasi"],
  answer: "Saya menemukan beberapa sinyal yang perlu dilihat bersama. Buka menu yang ingin dianalisis agar saya dapat memberi ringkasan dan rekomendasi yang lebih spesifik.",
};

const pageContexts: Record<string, PageContext> = {
  Overview: {
    label: "Overview Kabupaten Badung",
    intro: "Saya bisa merangkum situasi publik dan menunjukkan prioritas hari ini.",
    suggestions: ["Ringkas situasi hari ini", "Apa isu paling mendesak?", "Bandingkan dengan periode lalu"],
    answer: "Percakapan publik naik 10,4%. Kemacetan dan transportasi menjadi isu paling ramai, sementara 32 isu prioritas belum ditangani. Saya menyarankan tim memeriksa lonjakan keluhan koridor Kuta–Canggu dan antrean respons berprioritas tinggi.",
  },
  "Aspirasi Warga": {
    label: "Aspirasi Warga",
    intro: "Saya bisa mencari pola, merangkum percakapan, dan membantu memilih aspirasi untuk Finding.",
    suggestions: ["Cari aspirasi serupa", "Mana yang berprioritas tinggi?", "Buat ringkasan aspirasi baru"],
    answer: "Aspirasi negatif terbaru paling banyak berkaitan dengan layanan publik, sampah, dan mobilitas. Beberapa percakapan memiliki lokasi dan topik serupa sehingga layak digabungkan sebagai kandidat Finding sebelum diteruskan ke OPD.",
  },
  "Isu Daerah": {
    label: "Isu Daerah",
    intro: "Saya bisa menjelaskan tren isu, kontributor utama, dan perubahan penting.",
    suggestions: ["Apa hot topic bulan ini?", "Siapa kontributor teratas?", "Jelaskan lonjakan isu"],
    answer: "Kemacetan dan transportasi tumbuh paling cepat dengan kenaikan 24,6%. Konteks percakapan terkonsentrasi di Kuta Utara dan melibatkan Dishub, pelaku transportasi, serta wisatawan. Pola ini layak dipantau sebagai Finding aktif.",
  },
  Findings: {
    label: "AI Findings",
    intro: "Saya bisa menguji kekuatan evidence, menjelaskan pola, dan menyarankan tindak lanjut.",
    suggestions: ["Finding mana paling kuat?", "Periksa evidence yang lemah", "Apa yang layak jadi Case?"],
    answer: "Finding kemacetan koridor Kuta–Canggu memiliki pola lintas sumber dan evidence paling lengkap. Confidence tinggi, dampaknya meluas, dan sudah memiliki rekomendasi operasional sehingga paling siap untuk direview lalu dieskalasi menjadi Case.",
  },
  Cases: {
    label: "Case Management",
    intro: "Saya bisa membantu melihat SLA, hambatan eskalasi, dan langkah berikutnya.",
    suggestions: ["Case mana melewati SLA?", "Apa hambatan utama?", "Susun langkah berikutnya"],
    answer: "Prioritaskan Case dengan severity tinggi, tenggat terdekat, atau bukti eskalasi yang belum lengkap. Pastikan perjalanan email, surat fisik, disposisi OPD, dan lampiran tindak lanjut tercatat pada timeline yang sama.",
  },
  "Kinerja Layanan": {
    label: "Kinerja Layanan",
    intro: "Saya bisa menemukan SLA rendah, layanan terpadat, dan kandidat Case.",
    suggestions: ["Layanan mana SLA-nya rendah?", "Apa layanan paling sering?", "Buat rekomendasi per OPD"],
    answer: "Pengaduan Jalan & Drainase perlu perhatian khusus karena pencapaian SLA 61,8% terhadap target 85% dan memiliki backlog 42 layanan. Volume permohonan tertinggi tetap perlu dibandingkan dengan kapasitas tiap OPD sebelum dibuat Case.",
  },
  "CCTV Intelligence": {
    label: "CCTV Intelligence",
    intro: "Saya bisa merangkum kesehatan kamera, titik offline, dan lokasi yang perlu diperiksa.",
    suggestions: ["Kamera mana sedang offline?", "Ringkas kondisi koneksi", "Titik mana perlu perhatian?"],
    answer: "Periksa kamera berstatus offline atau connecting terlebih dahulu, lalu cocokkan lokasinya dengan isu lalu lintas dan Case aktif. Gangguan koneksi sebaiknya dicatat sebagai kejadian operasional beserta waktu terakhir kamera berhasil diperbarui.",
  },
  "Media Monitoring": {
    label: "Media Monitoring",
    intro: "Saya bisa membaca sentimen media, penulis, dan artikel yang paling berpengaruh.",
    suggestions: ["Siapa top contributor?", "Media mana paling negatif?", "Ringkas artikel penting"],
    answer: "Saya akan menilai kontribusi berdasarkan jumlah artikel, jangkauan, konsistensi topik, dan rata-rata sentimen. Klik media atau penulis untuk menelusuri artikel yang membentuk skornya.",
  },
  "Citra Kepala Daerah": {
    label: "Citra Kepala Daerah",
    intro: "Saya bisa membaca perubahan sentimen, narasi, dan aktor yang memengaruhinya.",
    suggestions: ["Apa narasi dominan?", "Mengapa sentimen berubah?", "Siapa aktor berpengaruh?"],
    answer: "Analisis perlu membedakan sentimen terhadap kepala daerah dari sentimen umum dalam artikel. Saya akan menyoroti narasi yang secara langsung menyebut aktor, sumber pembentuknya, dan perubahannya antarperiode.",
  },
  "Sumber Data": {
    label: "Sumber Data",
    intro: "Saya bisa membantu mengecek cakupan, kesehatan koneksi, dan kekosongan data.",
    suggestions: ["Sumber mana sedang offline?", "Ada gap negara atau kanal?", "Apa yang perlu dihubungkan?"],
    answer: "Periksa sumber yang tidak melakukan sinkronisasi sesuai jadwal dan kanal dengan cakupan wilayah rendah. Prioritas integrasi sebaiknya mengikuti kebutuhan analisis, kualitas metadata, dan ketersediaan API resmi.",
  },
};

function answerFor(question: string, context: PageContext): string {
  const normalized = question.toLocaleLowerCase("id-ID");
  if (normalized.includes("bukti") || normalized.includes("evidence")) {
    return "Saya akan membandingkan jumlah sumber, waktu publikasi, lokasi, kesamaan narasi, serta kualitas URL atau media. Evidence yang tidak memiliki sumber jelas perlu ditandai untuk review manusia sebelum dipakai sebagai dasar keputusan.";
  }
  if (normalized.includes("ringkas") || normalized.includes("summary")) return context.answer;
  if (normalized.includes("rekomendasi") || normalized.includes("tindak lanjut")) {
    return `${context.answer} Langkah berikutnya: validasi data penting, tentukan PIC, lalu catat keputusan dan bukti tindak lanjut agar audit trail tetap lengkap.`;
  }
  return context.answer;
}

export function AraAssistant({ activePage }: { activePage: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const context = useMemo(() => pageContexts[activePage] ?? defaultContext, [activePage]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function ask(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    setMessages(current => [
      ...current,
      { role: "user", text: cleanQuestion },
      { role: "ara", text: answerFor(cleanQuestion, context) },
    ]);
    setInput("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(input);
  }

  return (
    <div className={`${styles.root} ${open ? styles.open : ""}`}>
      {!open && (
        <div className={styles.hoverCard} role="status">
          <span className={styles.hoverEyebrow}>ARA · AI ASSISTANT</span>
          <strong>Tanya ARA tentang halaman ini</strong>
          <p>{context.intro}</p>
          <small>Klik untuk mulai percakapan</small>
        </div>
      )}

      {open && (
        <section className={styles.panel} aria-label="Percakapan dengan ARA">
          <header className={styles.panelHeader}>
            <div className={styles.avatar} aria-hidden="true"><span>✦</span></div>
            <div>
              <strong>ARA</strong>
              <span><i /> AI Intelligence Assistant</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup ARA">×</button>
          </header>

          <div className={styles.contextBar}>
            <span>MEMBACA KONTEKS</span>
            <strong>{context.label}</strong>
          </div>

          <div className={styles.conversation} aria-live="polite">
            <article className={styles.araMessage}>
              <span>ARA</span>
              <p>Halo, saya ARA. {context.intro}</p>
            </article>

            {messages.length === 0 && (
              <div className={styles.suggestions}>
                <small>COBA TANYAKAN</small>
                {context.suggestions.map(suggestion => (
                  <button type="button" key={suggestion} onClick={() => ask(suggestion)}>
                    <span>✦</span>{suggestion}<i>→</i>
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <article className={message.role === "ara" ? styles.araMessage : styles.userMessage} key={`${message.role}-${index}`}>
                <span>{message.role === "ara" ? "ARA" : "ANDA"}</span>
                <p>{message.text}</p>
              </article>
            ))}
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={`Tanya tentang ${context.label.toLocaleLowerCase("id-ID")}…`}
              aria-label="Pertanyaan untuk ARA"
            />
            <button type="submit" disabled={!input.trim()} aria-label="Kirim pertanyaan">↑</button>
          </form>
          <p className={styles.disclaimer}>Jawaban AI mengikuti data pada workspace aktif. Tetap lakukan review sebelum mengambil keputusan.</p>
        </section>
      )}

      <button
        type="button"
        className={styles.launcher}
        onClick={() => setOpen(value => !value)}
        aria-label={open ? "Tutup ARA" : "Buka ARA AI Assistant"}
        aria-expanded={open}
      >
        <span className={styles.launcherGlow} />
        <span className={styles.launcherIcon}>✦</span>
        <span className={styles.launcherText}><b>ARA</b><small>Ask AI</small></span>
        <i className={styles.onlineDot} />
      </button>
    </div>
  );
}
