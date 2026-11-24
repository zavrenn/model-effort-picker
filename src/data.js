// Data for the "Worth the switch?" page.
// Edit this file to update the page — no code changes needed.
// Snapshot: 24 November 2026. Source: Artificial Analysis (artificialanalysis.ai).

const D = {
  updated: "24 Nov 2026",

  efforts: [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
    { id: "xhigh", label: "XHigh" },
    { id: "max", label: "Max" }
  ],

  // intelligence = Artificial Analysis Intelligence Index
  // cost         = API cost (USD) per index task
  // approx       = read from the AA chart, not from a published table
  // slot         = model color (1–4)
  models: [
    {
      id: "sol", name: "GPT-6.2 Sol", short: "Sol", maker: "OpenAI", slot: 1,
      results: {
        low:    { intelligence: 41, cost: 0.18, approx: true },
        medium: { intelligence: 53, cost: 0.41 },
        high:   { intelligence: 55, cost: 0.56 },
        xhigh:  { intelligence: 56, cost: 0.65 },
        max:    { intelligence: 57, cost: 1.01 }
      }
    },
    {
      id: "astra", name: "GPT-6.2 Astra", short: "Astra", maker: "OpenAI", slot: 2,
      results: {
        low:    { intelligence: 46, cost: 0.66, approx: true },
        medium: { intelligence: 57, cost: 1.62, approx: true },
        high:   { intelligence: 60, cost: 2.07 },
        xhigh:  { intelligence: 62, cost: 2.52 },
        max:    { intelligence: 62, cost: 4.00 }
      }
    },
    {
      id: "opus", name: "Claude Opus 5.5", short: "Opus", maker: "Anthropic", slot: 3,
      results: {
        low:    { intelligence: 35, cost: 0.98, approx: true },
        medium: { intelligence: 48, cost: 2.45, approx: true },
        high:   { intelligence: 52, cost: 3.47, approx: true },
        xhigh:  { intelligence: 57, cost: 6.05 },
        max:    { intelligence: 59, cost: 10.04 }
      }
    },
    {
      id: "fable", name: "Claude Fable 5.2", short: "Fable", maker: "Anthropic", slot: 4,
      results: {
        low:    { intelligence: 54, cost: 3.10 },
        medium: { intelligence: 56, cost: 3.80 },
        high:   { intelligence: 62, cost: 9.08 },
        xhigh:  { intelligence: 62, cost: 14.83 },
        max:    { intelligence: 65, cost: 26.54 }
      }
    }
  ]
};
