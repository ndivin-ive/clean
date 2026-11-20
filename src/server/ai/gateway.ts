/**
 * AI gateway — the ONLY module allowed to talk to an AI provider (rule 5).
 *
 * Phase 1 ships no AI features. This stub fixes the boundary early: ESLint
 * forbids importing provider SDKs anywhere else (see eslint.config.mjs).
 * Phase 3 implements providers behind this interface.
 */
export type AiFeature = "prep_brief" | "outcome_draft";

export interface AiRequest {
  feature: AiFeature;
  organizationId: string;
  userId: string;
  prompt: string;
}

export interface AiResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export class AiDisabledError extends Error {
  constructor() {
    super("AI is not enabled for this organization.");
    this.name = "AiDisabledError";
  }
}

export async function generate(_request: AiRequest): Promise<AiResult> {
  throw new AiDisabledError();
}
