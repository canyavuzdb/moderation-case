import { ValidationError } from "./store";
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const expectedOrigin = url.protocol + "//" + (request.headers.get("host") || url.host);
  if (origin && origin !== expectedOrigin) throw new ValidationError("Bu kaynaktan değişiklik yapılamaz.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ValidationError("JSON içerik gerekli.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError("İstek gövdesi gerekli.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new ValidationError("İstek çok büyük.", 413); }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new ValidationError("Geçerli bir JSON nesnesi gönderin."); }
}
export function errorResponse(error: unknown) {
  if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Moderation request failed", error);
  return Response.json({ error: "Kayıt işlemi tamamlanamadı. Lütfen tekrar deneyin." }, { status: 500 });
}
