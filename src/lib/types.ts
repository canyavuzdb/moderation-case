export type Outcome = "appropriate" | "review" | "inappropriate";
export type Decision = "approved" | "rejected";
export type Finding = { rule: string; reason: string };
export type Assessment = { outcome: Outcome; findings: Finding[]; version: string; source?: "rules" | "ai" | "fallback"; model?: string; failure?: "quota" | "authentication" | "unavailable" | "invalid-response" };
export type DecisionEvent = { id: number; decision: Decision; note: string; decidedAt: string; legacy: boolean };
export type Comment = {
  id: string; text: string; createdAt: string; assessment: Assessment;
  decision: Decision | null; note: string; decidedAt: string | null; history: DecisionEvent[];
};
export const outcomeLabels: Record<Outcome, string> = {
  appropriate: "Uygun", review: "İnsan incelemesi gerekli", inappropriate: "Uygun değil",
};
export const decisionLabels = { approved: "Onaylandı", rejected: "Reddedildi" };
export function needsExplanation(outcome: Outcome, decision: Decision) {
  return (outcome === "appropriate" && decision === "rejected") ||
    (outcome === "inappropriate" && decision === "approved");
}
