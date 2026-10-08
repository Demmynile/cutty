// Routes through the Vercel AI Gateway (https://vercel.com/docs/ai-gateway) via
// the `ai` SDK. Auth is picked up automatically from AI_GATEWAY_API_KEY — no
// client construction needed, just pass a "creator/model-name" slug as the model.
export const AI_MODEL = process.env.AI_GATEWAY_MODEL || 'anthropic/claude-opus-5'

// Multimodal image model for the Virtual Try-On feature (Google "Nano Banana").
// It's a language model with image output, so it's called via generateText and
// the edited photo comes back in `result.files`. Override to a newer variant
// (e.g. google/gemini-3.1-flash-image-preview) via AI_GATEWAY_IMAGE_MODEL.
export const AI_IMAGE_MODEL = process.env.AI_GATEWAY_IMAGE_MODEL || 'google/gemini-2.5-flash-image'

const AI_EFFORT = (process.env.AI_GATEWAY_EFFORT as 'low' | 'medium' | 'high' | 'xhigh' | 'max') || 'medium'

// AI SDK 6 has no top-level `reasoning` option (that's AI SDK 7+), so effort is
// set via Anthropic's own provider option shape instead.
export const AI_PROVIDER_OPTIONS = {
  anthropic: {
    thinking: { type: 'adaptive' as const, effort: AI_EFFORT },
  },
}
