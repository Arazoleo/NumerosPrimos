import { describe, expect, it } from "vitest";

import {
  getUlamGalaxyTutorialCopy,
  ULAM_GALAXY_TUTORIAL_COPY,
  ULAM_GALAXY_TUTORIAL_STEPS,
} from "./ulamGalaxyTutorialCopy";

describe("Ulam Galaxy tutorial copy", () => {
  it("contains at most five steps", () => {
    expect(ULAM_GALAXY_TUTORIAL_STEPS).toHaveLength(5);
  });

  it("has a title and body for every step", () => {
    for (const step of ULAM_GALAXY_TUTORIAL_STEPS) {
      const copy = getUlamGalaxyTutorialCopy(step);

      expect(copy).not.toBeNull();
      expect(copy?.title.trim()).not.toBe("");
      expect(copy?.body.trim()).not.toBe("");
    }
  });

  it("has a visual spiral example in step two", () => {
    expect(ULAM_GALAXY_TUTORIAL_COPY[2].visual).toBe("spiral");
    expect(ULAM_GALAXY_TUTORIAL_COPY[2].body).toMatch(/espiral/i);
  });

  it("has a visual diagonal example in step three", () => {
    expect(ULAM_GALAXY_TUTORIAL_COPY[3].visual).toBe("diagonal");
    expect(ULAM_GALAXY_TUTORIAL_COPY[3].body).toMatch(/diagonal/i);
  });

  it("explains what the player must select to score", () => {
    const copy = ULAM_GALAXY_TUTORIAL_COPY[4];

    expect(copy.visual).toBe("direction");
    expect(copy.body).toMatch(/selecione/i);
    expect(copy.body).toMatch(/maior concentração de primos/i);
    expect(copy.body).toMatch(/Analisar trajetória/i);
  });

  it("shows scanner controls and the five regions in step five", () => {
    const copy = ULAM_GALAXY_TUTORIAL_COPY[5];

    expect(copy.visual).toBe("scanner");
    expect(copy.body).toMatch(/scanner/i);
    expect(copy.body).toMatch(/cinco regiões/i);
  });

  it("returns null for step zero", () => {
    expect(getUlamGalaxyTutorialCopy(0)).toBeNull();
  });

  it("covers the complete five-step navigation sequence", () => {
    for (const step of ULAM_GALAXY_TUTORIAL_STEPS) {
      expect(getUlamGalaxyTutorialCopy(step)).toBe(
        ULAM_GALAXY_TUTORIAL_COPY[step],
      );
    }
  });
});
