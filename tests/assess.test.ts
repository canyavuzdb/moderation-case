import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { assess } from "../src/lib/assess";
import { openStore } from "../src/lib/store";
const originalKey = process.env.GEMINI_API_KEY;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
});
const response = (outcome = "review", reason: unknown = "Bağlam yeterince açık değil; insan incelemesi gerekli.") => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ outcome, reason }) }] } }], modelVersion: "test-model" });
test("Anahtar yoksa hiçbir harici istek gönderilmez", async () => {
  delete process.env.GEMINI_API_KEY;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error(); };
  const result = await assess("Teşekkürler");
  assert.equal(calls, 0);
  assert.equal(result.source, "rules");
  assert.equal(result.outcome, "appropriate");
});
test("Gerçek istek sözleşmesi, JSON yanıtı ve karar sonrası kaynak kalıcılığı", async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\//);
    assert.ok(!String(url).includes("test-only-key"));
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-only-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.contents[0].parts[0].text, "Örnek yorum");
    assert.ok(body.systemInstruction);
    assert.equal(body.tools, undefined);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(init?.signal);
    return Response.json(response());
  };
  const assessment = await assess("Örnek yorum");
  assert.equal(assessment.source, "ai");
  assert.equal(assessment.model, "test-model");
  const store = openStore(":memory:");
  try {
    const saved = store.create("Örnek yorum", assessment);
    store.decide(saved.id, "approved");
    assert.deepEqual(store.get(saved.id)?.assessment, assessment);
  } finally { store.close(); }
});
for (const status of [401, 403, 429, 500]) test(`HTTP ${status}: yerel yedek değerlendirme açıkça kaydedilir`, async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  globalThis.fetch = async () => new Response("provider-private-detail", { status });
  const result = await assess("Teşekkürler");
  assert.equal(result.source, "fallback");
  assert.equal(result.outcome, "review");
  assert.ok(!JSON.stringify(result).includes("provider-private-detail"));
  assert.equal(result.failure, status === 429 ? "quota" : status === 500 ? "unavailable" : "authentication");
});
for (const value of [response("wrong"), response("review", ""), response("review", 2), {}, { candidates: [{ finishReason: "SAFETY" }] }, { candidates: [{ finishReason: "MAX_TOKENS" }] }]) test("Geçersiz veya engellenmiş yanıt AI sonucu diye kaydedilmez", async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  globalThis.fetch = async () => Response.json(value);
  const result = await assess("Teşekkürler");
  assert.equal(result.source, "fallback");
  assert.equal(result.outcome, "review");
});
test("Zaman aşımında açık yerel ihlal korunur", async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  globalThis.fetch = async () => { throw new DOMException("Timeout", "TimeoutError"); };
  const result = await assess("Sen aptalsın");
  assert.equal(result.source, "fallback");
  assert.equal(result.outcome, "inappropriate");
});
