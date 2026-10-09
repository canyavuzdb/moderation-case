import { withStore } from "@/lib/store";
import { readBody, errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readBody(request);
    return Response.json(withStore((store) => store.decide(id, body.decision, body.note)));
  } catch (error) { return errorResponse(error); }
}
