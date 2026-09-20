import type { AIProvider, ProposedItem, StructureRequest } from "../domain/types";

/**
 * Deterministic, offline provider: pattern rules for the most common care
 * facts in Spanish and English. Good enough for the demo and a safe default
 * because it never sends child data anywhere.
 */
const RULES: { re: RegExp; build: (m: RegExpMatchArray) => ProposedItem | null }[] = [
  // Allergies
  {
    re: /(?:no puede comer|es al[ée]rgic[oa] a|alergia a|al[ée]rgic[oa] al?|allergic to|can(?:'|no)?t eat|cannot eat)\s+([^,.;]+)/i,
    build: (m) => ({ section: "HEALTH", itemType: "ALLERGY", label: cap(clean(m[1])), confidence: 0.85 }),
  },
  // Medication
  {
    re: /(?:toma|se le da|le damos|takes|is given)\s+([^,.;]+?)(?:\s+(?:cada|a las|every|at)\s+([^,.;]+))?(?=[,.;]|$)/i,
    build: (m) => ({
      section: "HEALTH",
      itemType: "MEDICATION",
      label: cap(clean(m[1])),
      data: m[2] ? { schedule: clean(m[2]) } : null,
      confidence: 0.6,
    }),
  },
  // Nap / sleep time
  {
    re: /(?:duerme|siesta|se duerme|toma (?:la|una) siesta|naps?|sleeps|goes to sleep)\s+(?:normalmente\s+|usually\s+)?(?:a las|a la|alrededor de las|around|at)\s+([0-9]{1,2}(?::[0-9]{2})?)\s*(am|pm|h|hrs)?/i,
    build: (m) => ({
      section: "SLEEP",
      itemType: "SCHEDULE",
      label: "Siesta / Nap",
      data: { time: toTime(m[1], m[2]) },
      confidence: 0.8,
    }),
  },
  // Comfort object
  {
    re: /(?:busca su|pide su|quiere su|se calma con su|se tranquiliza con su|looks for (?:his|her|their)|asks for (?:his|her|their)|calms down with (?:his|her|their))\s+([^,.;]+)/i,
    build: (m) => ({ section: "COMFORT", itemType: "PREFERRED_OBJECT", label: cap(clean(m[1])), confidence: 0.8 }),
  },
  // Restricted food (non-allergy)
  {
    re: /(?:no le damos|no come|evitar|evitamos|avoid|doesn'?t eat|we don'?t give)\s+([^,.;]+)/i,
    build: (m) => ({ section: "NUTRITION", itemType: "RESTRICTED_FOOD", label: cap(clean(m[1])), confidence: 0.65 }),
  },
  // Favorite / likes
  {
    re: /(?:le gusta|le encanta|su favorit[oa] es|likes|loves)\s+([^,.;]+)/i,
    build: (m) => ({ section: "PLAY", itemType: "INTEREST", label: cap(clean(m[1])), confidence: 0.55 }),
  },
  // Phone contact
  {
    re: /([A-Za-zÁÉÍÓÚáéíóúñÑ ]{2,40}?)\s*(?:\(|:|-)?\s*(\+?\d[\d\s-]{7,}\d)/,
    build: (m) => ({
      section: "EMERGENCY",
      itemType: "CONTACT",
      label: cap(clean(m[1])),
      data: { phone: m[2].replace(/\s+/g, " ").trim() },
      confidence: 0.7,
    }),
  },
];

function clean(s: string): string {
  return s
    .replace(/\b(?:normalmente|usualmente|usually|siempre|always)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^(?:los|las|el|la|the|a|an)\s+/i, "")
    .trim();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toTime(value: string, suffix?: string): string {
  const parts = value.split(":").map((n) => parseInt(n, 10));
  let h = parts[0];
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  const sfx = (suffix ?? "").toLowerCase();
  if (sfx === "pm" && h < 12) h += 12;
  // Spanish "a las dos" conventions: small hours default to afternoon for naps.
  if (!sfx && h >= 1 && h <= 5) h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const NUMBER_WORDS: Record<string, string> = {
  una: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
  diez: "10",
  once: "11",
  doce: "12",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

function normalizeNumbers(text: string): string {
  return text.replace(
    /\b(a las|a la|at|around)\s+(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
    (_, p, w) => `${p} ${NUMBER_WORDS[w.toLowerCase()]}`,
  );
}

export class HeuristicAIProvider implements AIProvider {
  readonly name = "heuristic";

  async structureCareNotes(request: StructureRequest): Promise<ProposedItem[]> {
    const text = normalizeNumbers(request.text);
    const sentences = text.split(/(?<=[.;!?\n])\s+|,\s+y\s+|,\s+and\s+/i);
    const out: ProposedItem[] = [];
    const seen = new Set<string>();
    for (const sentence of sentences) {
      for (const rule of RULES) {
        const m = sentence.match(rule.re);
        if (!m) continue;
        const item = rule.build(m);
        if (!item || !item.label || item.label.length < 2) continue;
        if (request.sections && !request.sections.includes(item.section)) continue;
        const key = `${item.section}:${item.itemType}:${item.label.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  }
}
