import { assess } from "@/lib/assess";
import { validateComment, withStore } from "@/lib/store";
import { errorResponse, readBody } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(withStore((store) => store.list())); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const text = validateComment(body.text);
    const assessment = await assess(text);
    return Response.json(withStore((store) => store.create(text, assessment)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
