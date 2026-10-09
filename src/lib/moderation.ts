import type { Assessment, Finding, Outcome } from "./types";

export const RULE_VERSION = "1.3.0";
const word = (pattern: string) =>
  new RegExp("(?<![\\p{L}\\p{N}_])(?:" + pattern + ")(?![\\p{L}\\p{N}_])", "u");
const insult = word("aptal(?:sın|sin|sınız|siniz)?|salak(?:sın|sin|sınız|siniz)?|gerizekalı(?:sın|sin|sınız|siniz)?|gerizekâlı(?:sın|sin|sınız|siniz)?");
const directInsult = word("(?:sen|siz)\\s+(?:tam\\s+)?(?:bir\\s+)?(?:aptal|salak|gerizekalı|gerizekâlı)(?:sın|sin|sınız|siniz)?|(?:aptal|salak|gerizekalı|gerizekâlı)(?:sın|sin|sınız|siniz)");
const vulgarLanguage = word("bok|boktan");
const profanity = word("siktir|amk|orospu(?:sun(?:uz)?|lar(?:sınız)?|nun|ya|yu|luk)?(?:\\s+çocuğu)?");
const sexualRequest = word("(?:bana\\s+)?(?:çıplak|ciplak)\\s+(?:fotoğraf(?:ını)?|fotograf(?:ını)?|foto(?:nu)?)\\s+(?:gönder|gonder|at)|(?:benimle\\s+)?seks\\s+yap");
const explicitContent = word("porno\\s+izle|pornografik\\s+video|seks\\s+videosu");
const commercial = word("satın\\s+al|hemen\\s+kazan|para\\s+kazan|kampanya|indirim\\s+kodu|yüzde\\s+\\d+\\s+indirim");
const destination = /https?:\/\/[^\s]+|www\.[^\s]+|(?<!\p{L})(?:whatsapp|dm)(?!\p{L})/u;
const unfinishedAbuse = word("ta+m[ıi]na|senin\\s+ta+");
const maskedProfanity = word("a[.*_-]+m[.*_-]*k|s[.*_-]+ktir");
const spamCall = word("takip\\s+et|abone\\s+ol|bedava\\s+(?:kazan|hediye)|garantili\\s+kazanç");
const harassment = word("seninle\\s+(?:sonra\\s+)?görüşeceğiz|seni\\s+bulacağım|görürsün\\s+sen");
const contextualPhrase = new RegExp("(?:" + insult.source + "|" + profanity.source + "|" + sexualRequest.source + ")" +
  "\\s+(?:diye\\s+)?(?:demen|demesi|dedin|dedi|diyor|diyen|demek|sözcüğü|kelimesi|ifadesi|değilsin|değilsiniz|değilim)(?!\\p{L})", "gu");

export function evaluate(input: string): Assessment {
  const text = input.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/https?:\/\/[^\s]+|www\.[^\s]+|([\p{L}])\1{2,}/gu, (match, letter: string | undefined) => letter ?? match).replace(/\s+/gu, " ").trim();
  // shortcut: repeated letters and a small set of masked/incomplete expressions only; not general evasion detection.
  const matches: Array<Finding & { outcome: Outcome }> = [];
  function add(rule: string, reason: string, outcome: Outcome) {
    if (!matches.some((entry) => entry.rule === rule)) matches.push({ rule, reason, outcome });
  }
  function inspect(segment: string, quoted: boolean) {
    if (unfinishedAbuse.test(segment) || maskedProfanity.test(segment)) {
      add("incomplete-abuse", "Yarım bırakılmış veya gizlenmiş olası küfür ifadesi var; insan incelemesi gerekli.", "review");
    }
    if (vulgarLanguage.test(segment)) {
      add("vulgar-language", "Argo veya kaba bir ifade içeriyor; hedefi ve kullanım bağlamı insan tarafından incelenmeli.", "review");
    }
    const risky = insult.test(segment) || profanity.test(segment) || sexualRequest.test(segment) || explicitContent.test(segment);
    // shortcut: recognized quotation/reporting patterns only; use contextual analysis for broader language coverage.
    const contextual = quoted;
    if (risky && contextual) {
      add("contextual-language", "Riskli ifade alıntı veya aktarma bağlamında geçiyor; kullanım amacı insan tarafından değerlendirilmeli.", "review");
    } else {
      segment = segment.replace(contextualPhrase, () => {
        add("contextual-language", "Riskli söz aktarma veya olumsuzlama bağlamında geçiyor; insan incelemesi gerekli.", "review");
        return " ";
      });
      if (directInsult.test(segment)) {
        add("personal-insult", "Kişiye yönelik doğrudan aşağılayıcı bir ifade içeriyor.", "inappropriate");
      } else if (insult.test(segment)) {
        add("ambiguous-insult", "Aşağılayıcı olabilecek bir sözcük var; hedefi ve bağlamı net değil.", "review");
      }
      if (profanity.test(segment)) add("profanity", "Tanınan açık bir küfür ifadesi içeriyor.", "inappropriate");
      if (sexualRequest.test(segment)) add("sexual-harassment", "Doğrudan cinsel talep veya taciz ifadesi içeriyor.", "inappropriate");
      if (explicitContent.test(segment)) add("sexual-content", "Tanınan açık cinsel içerik veya pornografik içerik tanıtımı ifadesi içeriyor.", "inappropriate");
    }
    if (harassment.test(segment)) add("ambiguous-harassment", "Tehdit veya rahatsız etme olarak yorumlanabilecek bir ifade var; bağlam gerekli.", "review");
  }
  const quotes = /“([^”]*)”|«([^»]*)»|"([^"]*)"|'([^']*)'/gu;
  const outside = text.replace(quotes, (_match, ...groups: unknown[]) => {
    inspect(String(groups.slice(0, 4).find((value) => typeof value === "string") ?? ""), true);
    return " ";
  });
  if (maskedProfanity.test(outside)) add("masked-profanity", "Gizlenmiş olası küfür ifadesi var; insan incelemesi gerekli.", "review");
  for (const segment of outside.split(/[.!?;\n]+/u)) inspect(segment, false);
  if (spamCall.test(outside)) {
    add("possible-spam", "Takip, abonelik veya kazanç çağrısı içeriyor; istenmeyen tanıtım olup olmadığı incelenmeli.", "review");
  }
  if (commercial.test(outside)) {
    if (destination.test(outside)) {
      add("solicitation", "Ticari çağrı ile bağlantı veya iletişim yönlendirmesi birlikte bulunuyor.", "inappropriate");
    } else {
      add("ambiguous-promotion", "Ticari çağrı var; reklam olup olmadığı mevcut bağlamda net değil.", "review");
    }
  } else if (commercial.test(text)) {
    add("contextual-promotion", "Ticari çağrı alıntı içinde geçiyor; tanıtım amacı insan tarafından değerlendirilmeli.", "review");
  }
  const links = text.match(/(?:https?:\/\/|www\.)[^\s]+/gu);
  const linkContext = text.replace(/(?:https?:\/\/|www\.)[^\s]+/gu, "");
  if (links && !/[\p{L}\p{N}]/u.test(linkContext)) {
    add("unexplained-link", "Yorum yalnızca bağlantı içeriyor; paylaşım amacı ve içerikle ilişkisi insan tarafından incelenmeli.", "review");
  }
  // shortcut: observable spelling signals, not a Turkish grammar or meaning detector.
  const prose = text.replace(/https?:\/\/[^\s]+|www\.[^\s]+|`[^`]*`/gu, " ");
  const collapsed = prose.replace(/(?<=\p{L})[.*_-]+(?=\p{L})/gu, "");
  if (word("aq").test(collapsed) || /^(?:bu ne\s+)?ak[.!?\s]*$/u.test(prose)) {
    add("ambiguous-abbreviation", "Argo olarak kullanılabilecek bir kısaltma var; anlamı ve bağlamı insan tarafından incelenmeli.", "review");
  }
  if (collapsed !== prose && (insult.test(collapsed) || profanity.test(collapsed))) {
    add("obfuscated-language", "Harfleri simgelerle ayrılmış olası aşağılayıcı ifade var; insan incelemesi gerekli.", "review");
  }
  if (word("[bcçdfgğhjklmnpqrsştvwxyz]{7,}|asdf[\\p{L}]{3,}|qwer[\\p{L}]{3,}").test(prose)) {
    add("unclear-writing", "Uzun ünsüz dizisi veya klavye dizilimine benzeyen bir ifade var; anlamı kurallarla belirlenemedi.", "review");
  }
  if (!matches.length) return {
    outcome: "appropriate",
    findings: [{ rule: "no-match", reason: "Tanımlı ihlal kurallarıyla eşleşme bulunmadı." }],
    version: RULE_VERSION, source: "rules",
  };
  const outcome = matches.some((entry) => entry.outcome === "inappropriate") ? "inappropriate" : "review";
  return { outcome, findings: matches.map(({ rule, reason }) => ({ rule, reason })), version: RULE_VERSION, source: "rules" };
}
