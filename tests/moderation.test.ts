import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/lib/moderation";
import { examples } from "../src/lib/examples";

const expected = ["appropriate", "appropriate", "appropriate", "appropriate", "appropriate", "appropriate", "review", "inappropriate", "appropriate", "appropriate"];
for (const [index, example] of examples.entries()) test(example.name, () => {
  const result = evaluate(example.text);
  assert.equal(result.outcome, expected[index]);
  assert.ok(result.findings.every((finding) => finding.reason.length > 20));
});
for (const [text, outcome] of [
  ["SEN APTALSIN!", "inappropriate"],
  ["Porno izle: https://example.com/video", "inappropriate"],
  ["“Porno izle” reklamını şikâyet ediyorum.", "review"],
  ["Bana aptal demen doğru değil ama sen salaksın.", "inappropriate"],
  ["Sen aptal değilsin.", "review"],
  ["Sen bir salak.", "inappropriate"],
  ["Sen aptalsınlık diye bir kelime uydurdun.", "appropriate"],
  ["Siktir git.", "inappropriate"],
  ["“Siktir” ifadesini kullanmamalısın.", "review"],
  ["Bana aptal demen doğru değil.", "review"],
  ["Bana 'aptal' dedin. Sen salaksın.", "inappropriate"],
  ["Cinsel sağlık eğitimi çok yararlıydı.", "appropriate"],
  ["Hemen satın al!", "review"],
  ["“Hemen satın al” reklam sloganıdır.", "review"],
  ["Bu çözüm çok kötü ve yavaş.", "appropriate"],
  ["https://example.com kampanya örneğimiz", "inappropriate"],
  ["Bu aptal kim?", "review"],
  ["Bana çıplak fotoğrafını gönder. Seninle görüşeceğiz.", "inappropriate"],
]) test("Karşı örnek: " + text, () => assert.equal(evaluate(text).outcome, outcome));

for (const [text, outcome] of [
  ["Senin Taaaamina ....", "review"],
  ["Senin ta...", "review"],
  
  ["Sen salaaaksın", "inappropriate"],
  ["a*m*k", "review"],
  ["Beni takip et: https://example.com", "review"],
  ["Kanalıma abone ol", "review"],
  ["Hemen saa satın al: https://example.com", "inappropriate"],
  ["Çooook güzel anlatım", "appropriate"],
  ["Senin tarifin çok iyi", "appropriate"],
  ["Bu adımları sırayla takip ederek tamamladım", "appropriate"],
  ["https://example.com/notlar", "review"],
]) test("Yazım ve tanıtım: " + text, () => assert.equal(evaluate(text).outcome, outcome));

for (const text of ["Taaaamina", "Taaamina", "Tamina", "TAMINA", "tamına", "“Taaaamina” ifadesi"]) {
  test("Tek başına belirsiz ifade: " + text, () => assert.equal(evaluate(text).outcome, "review"));
}
for (const text of ["Vitamin almak", "Tamamına bak", "Ta kendisi"]) {
  test("Benzer masum ifade: " + text, () => assert.equal(evaluate(text).outcome, "appropriate"));
}

for (const text of ["bu ne ak!", "ak", "aq!", "bu ne a.q.", "s.a.l.a.k", "asdfghjkl", "qwrtypsdf"]) {
  test("Belirsiz yazım incelemesi: " + text, () => assert.equal(evaluate(text).outcome, "review"));
}
for (const text of ["teşekkürler", "çok iyi", "API ve CSS örneği", "Ak renk burada daha iyi", "Bu yöntem kötü", "Kaynak: https://example.com/qwrtypsdf", "const x = 1;"]) {
  test("Normal kısa veya teknik yorum: " + text, () => assert.equal(evaluate(text).outcome, "appropriate"));
}
test("Belirsiz yazım açık ihlalin önceliğini düşürmez", () => {
  assert.equal(evaluate("Sen aptalsın. qwrtypsdf").outcome, "inappropriate");
});

for (const [text, outcome] of [
  ["offf bu ne ya", "appropriate"],
  ["bok gibi", "review"],
  ["BOK GİBİ!", "review"],
  ["“bok gibi” ifadesini kullanmayalım", "review"],
  ["Bu boktan olmuş", "review"],
  ["Boks gibi sporları seviyorum", "appropriate"],
  ["Bu çizim kötü olmuş", "appropriate"],
  ["Sen aptalsın, bok gibi", "inappropriate"],
]) test("Argo ve olumsuz tepki ayrımı: " + text, () => assert.equal(evaluate(text).outcome, outcome));

for (const [text, outcome] of [
  ["orospu", "inappropriate"],
  ["OROSPU!", "inappropriate"],
  ["orospusun", "inappropriate"],
  ["orospular", "inappropriate"],
  ["“orospu” ifadesini kullanma", "review"],
  ["Bana orospu demen doğru değil", "review"],
  ["o.r.o.s.p.u", "review"],
  ["https://github.com/", "review"],
  ["http://127.0.0.1:3000", "review"],
  ["www.example.com", "review"],
  ["https://example.com https://github.com/", "review"],
  ["Örneğin kaynak kodu: https://github.com/", "appropriate"],
  ["Satın al: https://example.com", "inappropriate"],
  ["orospu https://example.com", "inappropriate"],
]) test("Açık küfür ve bağlantı bağlamı: " + text, () => assert.equal(evaluate(text).outcome, outcome));
