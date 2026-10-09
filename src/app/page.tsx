import { aiConfigured } from "@/lib/assess";
import { Dashboard } from "@/components/dashboard";
import { withStore } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Dashboard aiEnabled={aiConfigured()} initialComments={withStore((store) => store.list())} />;
}
