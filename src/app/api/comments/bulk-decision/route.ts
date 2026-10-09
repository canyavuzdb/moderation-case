import { withStore } from "@/lib/store";
import { readBody, errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    return Response.json(withStore(store => store.bulkDecide(body.ids, body.decision)));
  } catch (error) { return errorResponse(error); }
}
