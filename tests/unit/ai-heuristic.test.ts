import { describe, expect, it } from "vitest";
import { HeuristicAIProvider } from "@/modules/ai/infrastructure/heuristic.provider";

const provider = new HeuristicAIProvider();

describe("HeuristicAIProvider", () => {
  it("structures the canonical Spanish example into allergy, nap and comfort object", async () => {
    const items = await provider.structureCareNotes({
      text: "Mateo no puede comer cacahuates, duerme normalmente a las dos, y cuando se pone nervioso busca su dinosaurio azul.",
      locale: "es",
    });
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: "HEALTH", itemType: "ALLERGY", label: "Cacahuates" }),
        expect.objectContaining({ section: "SLEEP", itemType: "SCHEDULE", data: { time: "14:00" } }),
        expect.objectContaining({ section: "COMFORT", itemType: "PREFERRED_OBJECT", label: "Dinosaurio azul" }),
      ]),
    );
  });

  it("works in English", async () => {
    const items = await provider.structureCareNotes({
      text: "She is allergic to milk. She naps at 1 pm. She loves puzzles.",
      locale: "en",
    });
    expect(items.map((i) => i.itemType)).toEqual(expect.arrayContaining(["ALLERGY", "SCHEDULE", "INTEREST"]));
    expect(items.find((i) => i.itemType === "SCHEDULE")?.data).toEqual({ time: "13:00" });
  });

  it("never invents diagnoses: unknown text yields nothing", async () => {
    expect(await provider.structureCareNotes({ text: "Hoy fuimos al parque y jugó mucho.", locale: "es" })).toEqual([]);
  });

  it("respects the section hint", async () => {
    const items = await provider.structureCareNotes({
      text: "No puede comer fresas. Duerme a las 3.",
      locale: "es",
      sections: ["SLEEP"],
    });
    expect(items.every((i) => i.section === "SLEEP")).toBe(true);
  });
});
