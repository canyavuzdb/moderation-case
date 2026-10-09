import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET, POST } from "../src/app/api/comments/route";
import { PATCH } from "../src/app/api/comments/[id]/decision/route";
import { openStore } from "../src/lib/store";

const dir = mkdtempSync(join(tmpdir(), "moderation-test-"));
const originalKey = process.env.GEMINI_API_KEY;
const originalPath = process.env.MODERATION_DB_PATH;
before(() => { delete process.env.GEMINI_API_KEY; process.env.MODERATION_DB_PATH = join(dir, "test.db"); });
after(() => { if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; if (originalPath === undefined) delete process.env.MODERATION_DB_PATH; else process.env.MODERATION_DB_PATH = originalPath; rmSync(dir, { recursive: true, force: true }); });
const request = (body: unknown, method = "POST") => new Request("http://localhost/api/comments", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
test("API: oluştur, farklı kararda açıklama iste, kaydet ve yeniden aç", async () => {
  const created = await POST(request({ text: "Sen aptalsın.", assessment: { outcome: "appropriate" } }));
  assert.equal(created.status, 201);
  const comment = await created.json();
  assert.equal(comment.assessment.outcome, "inappropriate");
  const context = { params: Promise.resolve({ id: comment.id }) };
  const invalid = await PATCH(request({ decision: "approved", note: "  " }, "PATCH"), context);
  assert.equal(invalid.status, 400);
  const changed = await PATCH(request({ decision: "approved", note: "Örnek bağlamı moderatör tarafından incelendi.", assessment: { outcome: "appropriate" } }, "PATCH"), context);
  assert.equal(changed.status, 200);
  const saved = await changed.json();
  assert.deepEqual(saved.assessment, comment.assessment);
  assert.equal(saved.decision, "approved");
  const reopened = openStore();
  assert.deepEqual(reopened.get(comment.id), saved);
  reopened.close();
  const list = await (await GET()).json();
  assert.ok(list.some((entry: { id: string }) => entry.id === comment.id));
});
test("API: boş, uzun, yanlış türde yorumlar ve bozuk JSON", async () => {
  for (const text of ["", "  ", "a".repeat(2001), 123, null]) assert.equal((await POST(request({ text }))).status, 400);
  assert.equal((await POST(new Request("http://localhost/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await POST(request({ text: "a".repeat(17000) }))).status, 413);
});
test("API: geçersiz karar, olmayan kayıt ve uzun açıklama", async () => {
  const context = { params: Promise.resolve({ id: "missing" }) };
  assert.equal((await PATCH(request({ decision: "approved" }, "PATCH"), context)).status, 404);
  assert.equal((await PATCH(request({ decision: "invalid" }, "PATCH"), context)).status, 400);
  assert.equal((await PATCH(request({ decision: "approved", note: "a".repeat(501) }, "PATCH"), context)).status, 400);
});
test("API: inceleme sonucuna açıklamasız karar ve uygun yoruma gerekçeli ret", async () => {
  for (const [text, decision] of [["Seninle sonra görüşeceğiz.", "approved"], ["Çok iyi bir anlatım.", "rejected"]]) {
    const created = await (await POST(request({ text }))).json();
    const response = await PATCH(request({ decision, note: decision === "rejected" ? "Yayın bağlamına uygun bulunmadı." : "" }, "PATCH"), { params: Promise.resolve({ id: created.id }) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).assessment, created.assessment);
  }
});
test("API: dış kaynaktan yazma ve JSON olmayan içerik reddedilir", async () => {
  assert.equal((await POST(new Request("http://localhost/api/comments", { method: "POST", headers: { Origin: "https://example.com", "Content-Type": "application/json" }, body: '{"text":"merhaba"}' }))).status, 403);
  assert.equal((await POST(new Request("http://localhost/api/comments", { method: "POST", body: '{"text":"merhaba"}' }))).status, 415);
});
test("Örnek yükleme tekrarlandığında kayıtlar ve kararlar korunur", () => {
  const store = openStore();
  assert.equal(store.seed(), 10);
  const before = store.list();
  const sample = before.find((comment) => comment.text === "10 dakika giriş yaptın, asıl kısmı çok hızlı geçtin bence")!;
  store.decide(sample.id, "approved", "");
  assert.equal(store.seed(), 0);
  assert.equal(store.list().length, before.length);
  assert.equal(store.get(sample.id)?.decision, "approved");
  store.close();
});

test("API: Next.js iç URL'si farklı olsa da tarayıcının Host/Origin eşleşmesi kabul edilir", async () => {
  const response = await POST(new Request("http://localhost:3000/api/comments", {
    method: "POST", headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Host eşleşmesi örneği." }),
  }));
  assert.equal(response.status, 201);
});

test("API: geçersiz yorum modele gönderilmez; istemci kaynak bilgisi kabul edilmez", async () => {
  const previous = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-only-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ outcome: "review", reason: "Bağlam eksik olduğu için insan incelemesi gerekli." }) }] } }], modelVersion: "test-model" });
  };
  try {
    assert.equal((await POST(request({ text: " " }))).status, 400);
    assert.equal(calls, 0);
    const result = await (await POST(request({ text: "API yapay zekâ örneği", assessment: { source: "rules", outcome: "appropriate" } }))).json();
    assert.equal(calls, 1);
    assert.equal(result.assessment.source, "ai");
    assert.equal(result.assessment.outcome, "review");
    const store = openStore();
    try { assert.deepEqual(store.get(result.id)?.assessment, result.assessment); } finally { store.close(); }
  } finally { globalThis.fetch = previous; delete process.env.GEMINI_API_KEY; }
});
