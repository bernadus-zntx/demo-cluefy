"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CrawlerRuleDto, RuleType } from "../../lib/crawler";
import styles from "./crawler-configuration.module.css";

const ruleTypes: { type: RuleType; icon: string; label: string }[] = [
  { type: "URL", icon: "↗", label: "Website & feed" },
  { type: "Keyword", icon: "⌕", label: "Kata pencarian" },
  { type: "Hashtag", icon: "#", label: "Tag percakapan" },
  { type: "Penulis", icon: "✎", label: "Byline penulis" },
  { type: "Akun Social", icon: "@", label: "Akun publik" },
  { type: "Group Social", icon: "◎", label: "Komunitas publik" },
];

const emptyDraft = {
  type: "Keyword" as RuleType,
  value: "",
  source: "Semua media",
  scope: "Badung · Indonesia",
  interval: "10 menit",
  note: "",
};

export function CrawlerConfiguration() {
  const [rules, setRules] = useState<CrawlerRuleDto[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [filter, setFilter] = useState<RuleType | "Semua">("Semua");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  useEffect(() => {
    let active = true;
    fetch("/api/crawler-config", { cache: "no-store" })
      .then(response => response.json())
      .then(payload => {
        if (!active) return;
        setConfigured(Boolean(payload.configured));
        if (payload.configured && Array.isArray(payload.rules)) setRules(payload.rules);
        if (payload.error) setApiError(payload.error);
      })
      .catch(() => {
        if (active) {
          setConfigured(false);
          setApiError("Backend belum dapat dihubungi. Data tidak ditampilkan sampai koneksi pulih.");
        }
      });
    return () => { active = false; };
  }, []);

  const visibleRules = useMemo(() => rules.filter(rule => {
    const matchesType = filter === "Semua" || rule.type === filter;
    const haystack = `${rule.value} ${rule.source} ${rule.scope} ${rule.note}`.toLowerCase();
    return matchesType && haystack.includes(query.toLowerCase());
  }), [filter, query, rules]);

  const activeCount = rules.filter(rule => rule.status === "Aktif").length;
  const lastResults = rules.reduce((sum, rule) => sum + rule.results, 0);

  function openNew(type: RuleType = "Keyword") {
    setEditingId(null);
    setDraft({ ...emptyDraft, type, source: type === "URL" ? "Website" : type === "Akun Social" ? "Instagram" : type === "Group Social" ? "Facebook Group" : type === "Penulis" ? "Lintas media" : "Semua media" });
    setModalOpen(true);
  }

  function openEdit(rule: CrawlerRuleDto) {
    setEditingId(rule.id);
    setDraft({ type: rule.type, value: rule.value, source: rule.source, scope: rule.scope, interval: intervalLabel(rule.intervalMinutes), note: rule.note });
    setModalOpen(true);
  }

  async function saveRule(event: FormEvent) {
    event.preventDefault();
    if (!draft.value.trim()) return;
    setSaving(true);
    setApiError("");
    const existing = rules.find(rule => rule.id === editingId);
    const payload = {
      type: draft.type,
      value: draft.value.trim(),
      source: draft.source,
      scope: draft.scope,
      intervalMinutes: intervalMinutes(draft.interval),
      note: draft.note,
      status: existing?.status ?? "Aktif",
    };
    try {
      if (!configured) throw new Error("Supabase belum terhubung. Konfigurasi tidak disimpan.");
      const response = await fetch("/api/crawler-config", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Konfigurasi gagal disimpan.");
      setRules(current => editingId ? current.map(rule => rule.id === editingId ? result.rule : rule) : [result.rule, ...current]);
      setModalOpen(false);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Konfigurasi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: CrawlerRuleDto) {
    const nextRule = { ...rule, status: rule.status === "Aktif" ? "Dijeda" as const : "Aktif" as const };
    setRules(current => current.map(item => item.id === rule.id ? nextRule : item));
    if (!configured) {
      setRules(current => current.map(item => item.id === rule.id ? rule : item));
      setApiError("Supabase belum terhubung. Status tidak diubah.");
      return;
    }
    const response = await fetch("/api/crawler-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextRule) });
    const result = await response.json();
    if (!response.ok) {
      setRules(current => current.map(item => item.id === rule.id ? rule : item));
      setApiError(result.error || "Status gagal diperbarui.");
    }
  }

  async function removeRule() {
    if (!editingId) return;
    setSaving(true);
    try {
      if (!configured) throw new Error("Supabase belum terhubung. Konfigurasi tidak dihapus.");
      const response = await fetch(`/api/crawler-config?id=${encodeURIComponent(editingId)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Konfigurasi gagal dihapus.");
      setRules(current => current.filter(rule => rule.id !== editingId));
      setModalOpen(false);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Konfigurasi gagal dihapus.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.root}>
    <section className={styles.hero}>
      <div>
        <span>CRAWLER CONTROL CENTER</span>
        <h3>Atur apa yang perlu dicari ClueFy</h3>
        <p>Rule aktif dibaca crawler setiap 10 menit. Hasil baru dinormalisasi, diperiksa duplikasinya, lalu masuk ke intelligence pipeline.</p>
      </div>
      <button onClick={() => openNew()}>＋ Tambah konfigurasi</button>
    </section>

    <div className={styles.metrics}>
      <article><small>RULE AKTIF</small><strong>{activeCount}</strong><span>dari {rules.length} konfigurasi</span></article>
      <article><small>JADWAL UTAMA</small><strong>10 menit</strong><span>near real-time discovery</span></article>
      <article><small>HASIL TERDETEKSI</small><strong>{lastResults.toLocaleString("id-ID")}</strong><span>sebelum deduplication</span></article>
      <article className={`${styles.connection} ${configured ? styles.connected : ""}`}><small>BACKEND STORAGE</small><strong>{configured === null ? "Memeriksa..." : configured ? "Supabase terhubung" : "Belum terhubung"}</strong><span>{configured ? "PostgreSQL · persistent storage" : "Tambahkan credential Supabase"}</span></article>
    </div>

    {apiError && <div className={styles.apiError}><span>!</span><p>{apiError}</p><button onClick={() => setApiError("")}>×</button></div>}

    <section className={styles.typeGrid} aria-label="Tipe konfigurasi crawler">
      {ruleTypes.map(item => {
        const count = rules.filter(rule => rule.type === item.type).length;
        return <button key={item.type} onClick={() => setFilter(filter === item.type ? "Semua" : item.type)} className={filter === item.type ? styles.selectedType : ""}>
          <i>{item.icon}</i><span><b>{item.type}</b><small>{item.label}</small></span><em>{count}</em>
        </button>;
      })}
    </section>

    <section className={styles.directory}>
      <header>
        <div><h3>Monitoring Rules</h3><p>{visibleRules.length} konfigurasi ditampilkan · {configured ? "tersimpan di Supabase" : "menunggu koneksi Supabase"}</p></div>
        <div className={styles.tools}>
          {filter !== "Semua" && <button className={styles.clearFilter} onClick={() => setFilter("Semua")}>Semua tipe ×</button>}
          <label>⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari konfigurasi..." /></label>
        </div>
      </header>
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.tableHead}`}><span>RULE / TARGET</span><span>SUMBER</span><span>CAKUPAN</span><span>INTERVAL</span><span>LAST RUN</span><span>HASIL</span><span>STATUS</span><span></span></div>
        {visibleRules.map(rule => <div className={styles.row} key={rule.id}>
          <span className={styles.ruleIdentity}><i data-type={rule.type}>{ruleTypes.find(item => item.type === rule.type)?.icon}</i><span><small>{rule.type} · {rule.code}</small><b>{rule.value}</b><em>{rule.note}</em></span></span>
          <span>{rule.source}</span><span>{rule.scope}</span><span>{intervalLabel(rule.intervalMinutes)}</span><span>{formatLastRun(rule.lastRun)}</span><span className={styles.resultCount}>{rule.results}</span>
          <span><button className={`${styles.status} ${rule.status === "Aktif" ? styles.active : styles.paused}`} onClick={() => toggleRule(rule)}>● {rule.status}</button></span>
          <span><button className={styles.edit} onClick={() => openEdit(rule)} aria-label={`Edit ${rule.value}`}>•••</button></span>
        </div>)}
        {visibleRules.length === 0 && <div className={styles.empty}>Tidak ada konfigurasi yang cocok.</div>}
      </div>
    </section>

    <div className={styles.pipelineNote}><span>⇄</span><div><b>Kontrak dengan crawler</b><p>Crawler hanya membaca rule berstatus Aktif melalui API. Setiap hasil membawa <code>rule_id</code> agar sumber pencarian, audit trail, dan performa setiap rule dapat dilacak.</p></div><button className={configured ? styles.apiActive : ""}>{configured ? "API siap" : "API belum aktif"}</button></div>

    {modalOpen && <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="crawler-rule-title">
      <form className={styles.modal} onSubmit={saveRule}>
        <header><div><small>{editingId ? rules.find(rule => rule.id === editingId)?.code : "NEW CRAWLER RULE"}</small><h2 id="crawler-rule-title">{editingId ? "Edit konfigurasi" : "Tambah konfigurasi crawler"}</h2><p>Tentukan target yang akan dibaca pada siklus crawling berikutnya.</p></div><button type="button" onClick={() => setModalOpen(false)}>×</button></header>
        <div className={styles.formGrid}>
          <label><span>TIPE KONFIGURASI</span><select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value as RuleType }))}>{ruleTypes.map(item => <option key={item.type}>{item.type}</option>)}</select></label>
          <label><span>INTERVAL</span><select value={draft.interval} onChange={event => setDraft(current => ({ ...current, interval: event.target.value }))}><option>10 menit</option><option>30 menit</option><option>1 jam</option><option>6 jam</option><option>1 hari</option></select></label>
          <label className={styles.full}><span>{draft.type === "URL" ? "URL / DOMAIN" : draft.type === "Hashtag" ? "HASHTAG" : draft.type === "Penulis" ? "NAMA PENULIS" : draft.type === "Akun Social" ? "USERNAME / ACCOUNT ID" : draft.type === "Group Social" ? "NAMA / GROUP ID" : "KEYWORD"}</span><input value={draft.value} onChange={event => setDraft(current => ({ ...current, value: event.target.value }))} placeholder={draft.type === "URL" ? "contoh: media.com/bali" : draft.type === "Hashtag" ? "contoh: #Badung" : "Masukkan target monitoring"} required /></label>
          <label><span>SUMBER / PLATFORM</span><input value={draft.source} onChange={event => setDraft(current => ({ ...current, source: event.target.value }))} placeholder="Instagram, Media Online..." /></label>
          <label><span>CAKUPAN</span><input value={draft.scope} onChange={event => setDraft(current => ({ ...current, scope: event.target.value }))} placeholder="Badung · Indonesia" /></label>
          <label className={styles.full}><span>CATATAN & KONTEKS</span><textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="Jelaskan konteks agar rule mudah dipahami tim..." /></label>
        </div>
        <div className={styles.dedupeInfo}><span>✓</span><p><b>Duplicate protection aktif</b> URL canonical, source ID, dan content fingerprint akan diperiksa sebelum data dibuat.</p></div>
        <footer>{editingId ? <button type="button" className={styles.delete} onClick={removeRule} disabled={saving}>Hapus konfigurasi</button> : <span/>}<div><button type="button" onClick={() => setModalOpen(false)} disabled={saving}>Batal</button><button type="submit" disabled={saving}>{saving ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Aktifkan konfigurasi"}</button></div></footer>
      </form>
    </div>}
  </div>;
}

function intervalMinutes(label: string) {
  if (label === "1 jam") return 60;
  if (label === "6 jam") return 360;
  if (label === "1 hari") return 1440;
  return Number.parseInt(label, 10) || 10;
}

function intervalLabel(minutes: number) {
  if (minutes === 60) return "1 jam";
  if (minutes === 360) return "6 jam";
  if (minutes === 1440) return "1 hari";
  return `${minutes} menit`;
}

function formatLastRun(value: string | null) {
  if (!value) return "Belum dijalankan";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
