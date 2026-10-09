"use client";

import { useState, type ComponentProps } from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownLeft, Check, CheckCheck, CircleHelp, Clock3, Inbox, MessageSquare, Plus, Search, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { examples } from "@/lib/examples";
import { decisionLabels, needsExplanation, outcomeLabels, type Comment, type Decision, type Outcome } from "@/lib/types";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700";
function Button({ className, ...props }: Omit<ComponentProps<typeof BaseButton>, "className"> & { className?: string }) {
  return <BaseButton {...props} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-wait disabled:opacity-50", focus, className)} />;
}
const outcomeStyle: Record<Outcome, string> = {
  appropriate: "border-emerald-200 bg-emerald-50 text-emerald-800",
  review: "border-amber-200 bg-amber-50 text-amber-900",
  inappropriate: "border-rose-200 bg-rose-50 text-rose-800",
};
function Status({ outcome, compact = false }: { outcome: Outcome; compact?: boolean }) {
  return <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium", outcomeStyle[outcome])}>
    <span className={cn("size-1.5 shrink-0 rounded-full", outcome === "review" ? "bg-amber-600" : outcome === "appropriate" ? "bg-emerald-600" : "bg-rose-600")} />
    {compact && outcome === "review" ? "İnsan incelemesi" : outcomeLabels[outcome]}
  </span>;
}
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
}).format(new Date(value));

async function mutate<T = Comment>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}

function Modal({ title, description, children, open, onOpenChange }: {
  title: string; description: string; children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-950/35" />
      <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none">
        <div className="mb-2 flex items-center justify-between gap-4">
          <Dialog.Title className="text-balance text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Close aria-label="Pencereyi kapat" className={cn("rounded-md p-1.5 text-slate-500 hover:bg-slate-100", focus)}><X className="size-5" aria-hidden /></Dialog.Close>
        </div>
        <Dialog.Description className="mb-6 text-pretty text-sm leading-6 text-slate-500">{description}</Dialog.Description>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

function Composer({ open, onClose, onCreated, aiEnabled }: { aiEnabled: boolean; open: boolean; onClose: () => void; onCreated: (comment: Comment) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const comment = await mutate("/api/comments", "POST", { text });
      onCreated(comment); setText(""); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Bağlantı kurulamadı."); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onOpenChange={(value) => { if (!value && !busy) onClose(); }} title="Yeni yorum ekle"
    description={aiEnabled ? "Yorum metni değerlendirme için Google Gemini hizmetine gönderilir. Sonuç ve kullanılan yöntem kaydedilir." : "Temel mod: yorum bu cihazda yerel kurallarla değerlendirilir. Harici hizmete gönderilmez."}>
    <form onSubmit={submit} aria-busy={busy}>
      <label htmlFor="new-comment" className="mb-2 block text-sm font-medium">Yorum metni <span className="text-slate-500">(zorunlu)</span></label>
      <textarea id="new-comment" required maxLength={2000} value={text} onChange={(event) => setText(event.target.value)}
        placeholder="Örneğin: Anlatım biraz hızlıydı, örnekleri çoğaltabilir misin?"
        aria-describedby={error ? "comment-help comment-error" : "comment-help"} aria-invalid={!!error}
        className={cn("min-h-32 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6 placeholder:text-slate-500", focus)} />
      <p id="comment-help" className="mt-1 text-right text-xs text-slate-500 tabular-nums">{text.length} / 2000</p>
      <p className="mt-5 mb-2 text-xs font-medium text-slate-600">Veya bir örnekle deneyin</p>
      <div className="flex flex-wrap gap-2">{examples.map((example) =>
        <Button key={example.name} type="button" disabled={busy} onClick={() => { setText(example.text); setError(""); }}
          className="h-9 border border-slate-200 px-3 text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50">{example.name}</Button>)}</div>
      {error && <p role="alert" id="comment-error" className="mt-4 text-sm text-rose-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" disabled={busy} onClick={onClose} className="border border-slate-200 px-4 py-2.5">Vazgeç</Button>
        <Button type="submit" disabled={busy} className="bg-slate-900 px-4 text-white hover:bg-slate-800">
          <ShieldCheck className="size-4" aria-hidden />{busy ? "Değerlendiriliyor…" : "Değerlendir ve ekle"}
        </Button>
      </div>
    </form>
  </Modal>;
}

function DecisionForm({ comment, onSaved }: { comment: Comment; onSaved: (comment: Comment) => void }) {
  const [choice, setChoice] = useState<Decision | null>(comment.decision);
  const [note, setNote] = useState(comment.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const explain = !!choice && needsExplanation(comment.assessment.outcome, choice);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!choice) { setError("Kaydetmeden önce onay veya ret seçin."); return; }
    if (explain && !note.trim()) { setError("Sistem önerisinden farklı karar için kısa bir açıklama yazın."); return; }
    setBusy(true);
    try {
      onSaved(await mutate("/api/comments/" + comment.id + "/decision", "PATCH", { decision: choice, note }));
    } catch (error) { setError(error instanceof Error ? error.message : "Bağlantı kurulamadı."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="border-t border-slate-200 pt-5" aria-busy={busy}>
    <div className="mb-1 flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold">2</span><h3 className="text-balance font-semibold">Yönetici kararı</h3></div>
    <p className="mb-4 text-pretty text-xs leading-5 text-slate-500">Son söz sizde. Kararınız sistem önerisini değiştirmez.</p>
    {comment.decision && <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
      <p className="font-medium">Kaydedilen karar: {decisionLabels[comment.decision]}</p>
      {comment.note && <p className="mt-1 text-pretty text-slate-600">{comment.note}</p>}
      <p className="mt-1 text-xs text-slate-500">{date(comment.decidedAt!)} · Kararı aşağıdan güncelleyebilirsiniz.</p>
      <details className="mt-3 border-t border-slate-200 pt-2">
        <summary className={cn("w-fit cursor-pointer rounded text-xs font-medium text-slate-600 hover:text-slate-900", focus)}>Karar geçmişi <span className="tabular-nums">({comment.history.length})</span></summary>
        <ol className="mt-3 space-y-3" aria-label="Karar geçmişi, yeniden eskiye">
          {comment.history.map((entry, index) => <li key={entry.id} className="border-l border-slate-300 pl-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{decisionLabels[entry.decision]}{index === 0 ? " · Güncel" : ""}</span><time dateTime={entry.decidedAt} className="text-slate-500 tabular-nums">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(entry.decidedAt))}</time></div>
            <p className="mt-1 break-words text-pretty leading-5 text-slate-600">{entry.note || "Açıklama eklenmedi."}</p>
            {entry.legacy && <p className="mt-1 text-pretty leading-5 text-slate-500">Geçmiş özelliği eklenmeden önceki son kayıt. Daha eski kararlar tutulmamıştı.</p>}
          </li>)}
        </ol>
      </details>
    </div>}
    <div className="mb-4 grid grid-cols-2 gap-3" role="group" aria-label="Yönetici kararı seçimi">
      <Button type="button" aria-pressed={choice === "approved"} disabled={busy} onClick={() => { setChoice("approved"); setError(""); }}
        className={cn("border px-4", choice === "approved" ? "border-slate-700 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
        <Check className="size-4" aria-hidden />Onayla</Button>
      <Button type="button" aria-pressed={choice === "rejected"} disabled={busy} onClick={() => { setChoice("rejected"); setError(""); }}
        className={cn("border px-4", choice === "rejected" ? "border-rose-600 bg-rose-50 text-rose-900" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
        <X className="size-4" aria-hidden />Reddet</Button>
    </div>
    {explain && <p id="override-help" className="mb-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-pretty text-xs leading-5 text-amber-900"><ArrowDownLeft className="mt-0.5 size-4 shrink-0" aria-hidden />Sistem önerisinden farklı bir karar seçtiniz. Lütfen nedenini açıklayın.</p>}
    <label htmlFor="decision-note" className="mb-2 block text-xs font-medium text-slate-600">Karar açıklaması <span className="font-normal">({explain ? "zorunlu" : "isteğe bağlı"})</span></label>
    <textarea id="decision-note" value={note} maxLength={500} required={explain} onChange={(event) => setNote(event.target.value)}
      aria-invalid={!!error} aria-describedby={cn("note-help", explain && "override-help", error && "decision-error")}
      placeholder="Kararınızın nedenini kısaca paylaşın…"
      className={cn("min-h-20 w-full resize-y rounded-lg border border-slate-200 p-3 text-sm leading-5 placeholder:text-slate-500", focus)} />
    <div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span id="note-help">Açıklama kararınızla birlikte saklanır.</span><span className="tabular-nums">{note.length}/500</span></div>
    {error && <p id="decision-error" role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    <Button type="submit" disabled={busy} className="mt-4 w-full bg-slate-900 px-4 text-white hover:bg-slate-800">
      <CheckCheck className="size-4" aria-hidden />{busy ? "Kaydediliyor…" : "Kararı kaydet"}
    </Button>
  </form>;
}

type Filter = "all" | "pending" | "review" | "decided";
export function Dashboard({ initialComments, aiEnabled = false }: { initialComments: Comment[]; aiEnabled?: boolean }) {
  const [comments, setComments] = useState(initialComments);
  const [selectedId, setSelectedId] = useState(initialComments.find((c) => c.assessment.outcome === "review")?.id ?? initialComments[0]?.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome | "all">("all");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [compose, setCompose] = useState(false);
  const [principles, setPrinciples] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = comments.filter((c) => !c.decision).length;
  const review = comments.filter((c) => c.assessment.outcome === "review" && !c.decision).length;
  const decided = comments.length - pending;
  const filtered = comments.filter((c) => (filter === "all" || (filter === "pending" && !c.decision) ||
    (filter === "review" && c.assessment.outcome === "review" && !c.decision) || (filter === "decided" && !!c.decision)) &&
    (outcomeFilter === "all" || c.assessment.outcome === outcomeFilter) &&
    c.text.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const bulkAllowed = filter === "pending" && (outcomeFilter === "appropriate" || outcomeFilter === "inappropriate");
  const eligible = bulkAllowed ? filtered.filter(c => !c.decision) : [];
  const checked = eligible.filter(c => checkedIds.includes(c.id));
  async function submitBulk() {
    setBulkBusy(true); setBulkError("");
    try {
      const updated = await mutate<Comment[]>("/api/comments/bulk-decision", "PATCH", {
        ids: checked.map(c => c.id), decision: outcomeFilter === "appropriate" ? "approved" : "rejected",
      });
      setComments(current => current.map(c => updated.find(u => u.id === c.id) ?? c));
      setCheckedIds([]); setBulkOpen(false);
      setNotice(`${updated.length} yorum ${outcomeFilter === "appropriate" ? "onaylandı" : "reddedildi"}. Kararlar geçmişe kaydedildi.`);
    } catch (error) { setBulkError(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
    finally { setBulkBusy(false); }
  }
  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0];
  function saved(updated: Comment) {
    setComments((current) => current.map((c) => c.id === updated.id ? updated : c));
    setNotice("Karar kaydedildi: " + decisionLabels[updated.decision!] + ". İlk sistem önerisi korundu.");
  }
  return <div className="min-h-dvh">
    <a href="#main" className={cn("sr-only fixed top-3 left-3 z-50 rounded-lg bg-white px-4 py-2 focus:not-sr-only", focus)}>İçeriğe geç</a>
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="#main" aria-label="Yorum yönetimi ana sayfa" className={cn("inline-flex items-center gap-2.5 rounded-md", focus)}>
            <span className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700"><ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden /></span>
            <span className="ml-2 hidden border-l border-slate-200 pl-4 text-xs text-slate-500 sm:inline">Yorum yönetimi</span>
          </a>
          <div className="flex items-center gap-3">
            <Button onClick={() => setPrinciples(true)} className="h-9 px-3 text-xs text-slate-600 hover:bg-slate-50"><CircleHelp className="size-4" aria-hidden />Nasıl çalışır?</Button>
            <span className="hidden border-l border-slate-200 pl-4 text-xs text-slate-500 sm:inline">Yerel çalışma alanı</span>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-balance text-2xl font-semibold">Yorumlar</h1><p className="mt-1.5 text-pretty text-sm text-slate-500">Sistem önerisini inceleyin, son kararı verin.</p></div>
          <Button onClick={() => setCompose(true)} className="bg-slate-900 px-4 text-white hover:bg-slate-800"><Plus className="size-4" aria-hidden />Yeni yorum</Button>
        </div>
        <dl className="mb-5 grid grid-cols-2 gap-y-4 border-y border-slate-200 py-4 sm:grid-cols-4">
          {[
            { label: "Toplam yorum", value: comments.length },
            { label: "Karar bekliyor", value: pending },
            { label: "İnsan incelemesi", value: review },
            { label: "Karara bağlandı", value: decided },
          ].map(({ label, value }, index) => <div key={label} className={cn("px-4 sm:px-5", index > 0 && "sm:border-l sm:border-slate-200", index === 0 && "sm:pl-0")}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>)}
        </dl>
        <p role="status" className={cn("text-sm text-slate-800", notice ? "mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" : "sr-only")}>{notice}</p>
        <section id="queue" aria-label="Yorum kuyruğu" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2.5"><Inbox className="size-4 text-slate-500" aria-hidden /><h2 className="text-balance text-sm font-semibold">Yorum kuyruğu</h2><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 tabular-nums">{filtered.length}</span></div>
            <label className="relative block"><span className="sr-only">Yorumlarda ara</span><Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-500" aria-hidden />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setCheckedIds([]); }} placeholder="Yorumlarda ara…" className={cn("h-9 w-56 max-w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm", focus)} /></label>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-slate-200 px-4 pt-2" aria-label="Yorum filtreleri">
            {([{ id: "all", label: "Tümü", count: comments.length }, { id: "pending", label: "Bekleyen", count: pending },
              { id: "review", label: "İnceleme", count: review }, { id: "decided", label: "Karar verilen", count: decided }] as const).map((tab) =>
              <Button key={tab.id} aria-pressed={filter === tab.id} onClick={() => { setFilter(tab.id); setCheckedIds([]); setNotice(""); }}
                className={cn("h-10 rounded-none border-b-2 px-3 text-xs", filter === tab.id ? "border-slate-700 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-800")}>{tab.label}<span className={cn("rounded px-1.5 py-0.5 tabular-nums", filter === tab.id ? "bg-slate-50" : "bg-slate-100")}>{tab.count}</span></Button>)}
            <label className="mb-2 ml-auto flex items-center gap-2 self-center pl-2 text-xs text-slate-500">
              Sonuç
              <select aria-label="Sistem sonucu" value={outcomeFilter}
                onChange={(event) => { setOutcomeFilter(event.target.value as Outcome | "all"); setCheckedIds([]); setNotice(""); }}
                className={cn("h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700", focus)}>
                <option value="all">Tüm sonuçlar</option>
                <option value="appropriate">Uygun</option>
                <option value="inappropriate">Uygun değil</option>
                <option value="review">İnceleme gerekli</option>
              </select>
            </label>
          </div>
          <div className="grid lg:grid-cols-2">
            <div className="border-b border-slate-200 bg-slate-50/40 lg:border-r lg:border-b-0">
          {bulkAllowed && eligible.length > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-5 py-2 text-xs">
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-slate-600">
              <input type="checkbox" className={cn("size-4 accent-slate-800", focus)} checked={checked.length === eligible.length}
                onChange={event => setCheckedIds(event.target.checked ? eligible.map(c => c.id) : [])} />
              Bekleyenlerin tümünü seç ({eligible.length})
            </label>
            <span className="text-slate-500 tabular-nums" role="status">{checked.length} seçildi</span>
            <Button disabled={!checked.length || checked.length > 100} onClick={() => { setBulkError(""); setBulkOpen(true); }} className="ml-auto h-8 border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50">
              {outcomeFilter === "appropriate" ? "Seçilenleri onayla" : "Seçilenleri reddet"}
            </Button>
            {checked.length > 100 && <p className="w-full text-rose-700">Bir işlemde en fazla 100 yorum seçilebilir.</p>}
          </div>}
              <div className="flex justify-between px-5 py-3 text-xs text-slate-500"><span>Yorum ve sistem önerisi</span><span>Yeniden eskiye</span></div>
              {!filtered.length ? <div className="p-10 text-center"><Search className="mx-auto mb-3 size-6 text-slate-300" aria-hidden /><h3 className="text-balance text-sm font-medium">Burada henüz yorum yok</h3><p className="my-2 text-pretty text-xs text-slate-500">{comments.length ? "Aramayı veya filtreyi değiştirerek tekrar deneyin." : "İlk yorumunuzu ekleyerek değerlendirmeyi deneyin."}</p>
                <Button onClick={() => { if (comments.length) { setQuery(""); setFilter("all"); setOutcomeFilter("all"); setCheckedIds([]); } else setCompose(true); }} className="mt-2 text-xs text-slate-800">{comments.length ? "Filtreleri temizle" : "Yeni yorum ekle"}</Button></div> :
                <ul className="max-h-96 overflow-y-auto lg:max-h-[780px]">{filtered.map((comment, index) => <li key={comment.id} className={cn("relative border-t border-slate-100", selected?.id === comment.id && "bg-slate-100/70")}>
                  {bulkAllowed && !comment.decision && <label className="absolute top-2.5 left-2 z-10 flex size-9 cursor-pointer items-center justify-center rounded-md hover:bg-slate-200/50">
                    <input type="checkbox" aria-label={`${index + 1}. yorumu seç: ${comment.text}`} className={cn("size-3.5 cursor-pointer accent-slate-700", focus)}
                      checked={checkedIds.includes(comment.id)} onChange={event => setCheckedIds(ids => event.target.checked ? [...ids, comment.id] : ids.filter(id => id !== comment.id))} />
                  </label>}
                  <Button onClick={() => { setSelectedId(comment.id); setNotice(""); }} aria-pressed={selected?.id === comment.id}
                    className="h-auto w-full min-w-0 justify-start gap-3 rounded-none px-5 py-4 text-left hover:bg-slate-100/70">
                    <span aria-hidden={bulkAllowed && !comment.decision ? true : undefined} className="mt-0.5 w-5 shrink-0 self-start text-xs font-medium text-slate-500 tabular-nums">{bulkAllowed && !comment.decision ? "" : String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1"><span className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">Örnek yorum</span><span className="text-xs font-normal text-slate-500 tabular-nums">{date(comment.createdAt)}</span></span>
                      <span className="mb-2 block line-clamp-2 break-words text-sm leading-5 font-normal text-slate-700">{comment.text}</span>
                      <span className="flex flex-wrap items-center justify-between gap-2"><Status outcome={comment.assessment.outcome} compact />
                        <span className="flex items-center gap-1 text-xs font-normal text-slate-500">{comment.decision ? <CheckCheck className="size-3.5" aria-hidden /> : <Clock3 className="size-3" aria-hidden />}{comment.decision ? decisionLabels[comment.decision] : "Karar bekliyor"}</span></span>
                    </span>
                  </Button>
                </li>)}</ul>}
            </div>
            <div className="min-w-0 p-5 sm:p-6">
              {selected ? <div>
                <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-balance text-sm font-semibold">Yorum detayı</h2></div>
                <div className={cn("mb-5 rounded-lg border p-4", outcomeStyle[selected.assessment.outcome])}>
                  <div className="mb-3 flex items-center gap-2 text-xs text-slate-500"><MessageSquare className="size-3.5" aria-hidden />Metin yorumu</div>
                  <p className="break-words text-pretty text-base leading-7 text-slate-800">{selected.text}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">{date(selected.createdAt)} · Yorum kaydı</p><span className="text-xs font-medium">{outcomeLabels[selected.assessment.outcome]}</span></div>
                </div>
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-slate-50 text-xs font-semibold text-slate-800">1</span><h3 className="text-balance font-semibold">Sistem değerlendirmesi</h3></div>
                  <p className="mt-3 text-xs text-slate-600">{selected.assessment.source === "ai" ? "Gemini · Yapay zekâ ile değerlendirildi" : selected.assessment.source === "fallback" ? "Yapay zekâ değerlendirmesi tamamlanamadı · Yerel kurallar kullanıldı" : "Temel mod · Kural tabanlı değerlendirme"}</p>
                  <ul className="mt-3 space-y-2">{selected.assessment.findings.map((finding) => <li key={finding.rule} className="text-pretty text-sm leading-6 text-slate-600">{finding.reason}</li>)}</ul>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="size-3.5" aria-hidden />İlk değerlendirme korunur.</p>
                </div>
                <DecisionForm key={selected.id + selected.decidedAt} comment={selected} onSaved={saved} />
              </div> : <div className="flex min-h-96 flex-col items-center justify-center text-center"><Inbox className="mb-4 size-10 text-slate-200" aria-hidden /><p className="text-sm text-slate-500">İncelemek için bir yorum seçin.</p></div>}
            </div>
          </div>
        </section>
        <footer className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Yorum yönetimi</span></footer>
      </main>
    </div>
    <Modal open={bulkOpen} onOpenChange={value => { if (!bulkBusy) setBulkOpen(value); }}
      title={outcomeFilter === "appropriate" ? "Toplu onayı doğrula" : "Toplu reddi doğrula"}
      description={`${checked.length} yorum için sistem önerisiyle uyumlu yönetici kararı kaydedilecek. İlk değerlendirmeler korunur; her işlem karar geçmişine eklenir.`}>
      <ul className="mb-4 max-h-52 space-y-2 overflow-y-auto text-sm text-slate-600">{checked.map(c => <li key={c.id} className="break-words rounded border border-slate-200 p-2">{c.text}</li>)}</ul>
      {bulkError && <p role="alert" className="mb-3 text-sm text-rose-700">{bulkError}</p>}
      <div className="flex justify-end gap-2"><Button disabled={bulkBusy} onClick={() => setBulkOpen(false)} className="border border-slate-200">Vazgeç</Button>
        <Button disabled={bulkBusy || !checked.length || checked.length > 100} onClick={submitBulk} className="bg-slate-900 text-white hover:bg-slate-800">{bulkBusy ? "Kaydediliyor…" : `${checked.length} yorumu ${outcomeFilter === "appropriate" ? "onayla" : "reddet"}`}</Button></div>
    </Modal>
    <Composer aiEnabled={aiEnabled} open={compose} onClose={() => setCompose(false)} onCreated={(comment) => {
      setComments((current) => [comment, ...current]); setSelectedId(comment.id); setFilter("all"); setQuery(""); setOutcomeFilter("all"); setCheckedIds([]);
      setNotice("Yorum değerlendirildi ve kaydedildi: " + outcomeLabels[comment.assessment.outcome] + ".");
    }} />
    <Modal open={principles} onOpenChange={setPrinciples} title="Açık kurallar, insan kararı" description="Anahtar tanımlıysa yeni yorumlar Gemini ile, yoksa yerel kurallarla değerlendirilir. Her kayıtta gerçekten kullanılan yöntem belirtilir. Son karar yöneticinindir.">
      <div className="space-y-4 text-sm leading-6 text-slate-600">
        <div className="rounded-xl bg-slate-50 p-4"><h3 className="mb-1 text-balance font-semibold text-slate-900">Eleştiri, hakaret değildir.</h3><p className="text-pretty">“Anlatım biraz hızlıydı” gibi içeriğe yönelik eleştiriler ihlal sayılmaz. Sistem, kişiyi hedef alan ifadeleri ayrı kurallarla değerlendirir.</p></div>
        <p className="text-pretty"><strong>Bağlam belirsizse:</strong> alıntılanan riskli sözler ve olası tehditler insan incelemesine gider. Bağlantı tek başına reklam sayılmaz; ticari çağrı ile birlikte değerlendirilir.</p>
        <p className="text-pretty"><strong>Son karar sizde:</strong> onay veya ret verebilirsiniz. Sistem önerisinin tersine karar verirseniz kısa açıklama gerekir. İlk öneri korunur.</p>
        <p className="rounded-lg border border-slate-200 p-3 text-pretty text-xs text-slate-500"><strong>Sınır:</strong> her iki yöntem de hata yapabilir. Model bağlantısı başarısızsa yerel kurallar kullanılır; ihlal bulunmayan yorumlar da incelemeye ayrılır. Temel modda “Uygun”, yalnızca tanımlı kurallarla eşleşme bulunmadığı anlamına gelir. Bu bir üretim moderasyon sistemi değildir.</p>
      </div>
    </Modal>
  </div>;
}
