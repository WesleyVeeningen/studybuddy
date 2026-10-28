// All model calls go through Vercel AI Gateway (auth via OIDC on Vercel, or AI_GATEWAY_API_KEY).
// TUTOR_MODEL can be overridden per environment, e.g. for testing on the gateway's free tier.
export const TUTOR_MODEL = process.env.TUTOR_MODEL || "anthropic/claude-sonnet-5.5";
// Multilingual (incl. Dutch), 1536 dimensions to match the chunks.embedding column.
export const EMBEDDING_MODEL = "cohere/embed-v4.0";
