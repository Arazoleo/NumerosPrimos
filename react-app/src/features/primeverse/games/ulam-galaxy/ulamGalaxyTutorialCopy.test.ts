import { describe, expect, it } from "vitest";

import {
  getUlamGalaxyTutorialCopy,
  ULAM_GALAXY_TUTORIAL_COPY,
  ULAM_GALAXY_TUTORIAL_STEPS,
} from "./ulamGalaxyTutorialCopy";
import {
  isUlamTutorialPrime,
  ULAM_TUTORIAL_GRID,
} from "./UlamGalaxyTutorialGrid";

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

    const diagonalPrimes = ULAM_TUTORIAL_GRID.filter(
      (cell) => cell.diagonal && isUlamTutorialPrime(cell.value),
    );
    expect(diagonalPrimes.map((cell) => cell.value)).toEqual([13, 3, 7]);
    expect(ULAM_TUTORIAL_GRID.filter((cell) => cell.diagonal).map((cell) => cell.value)).toEqual([13, 3, 7]);
  });

  it("highlights only primes in the spiral and diagonal grids", () => {
    expect(isUlamTutorialPrime(2)).toBe(true);
    expect(isUlamTutorialPrime(21)).toBe(false);
    expect(isUlamTutorialPrime(1)).toBe(false);
  });

  it("explains that step four uses the scanner and telemetry", () => {
    const copy = ULAM_GALAXY_TUTORIAL_COPY[4];

    expect(copy.visual).toBeUndefined();
    expect(copy.title).toMatch(/scanner|escaneie/i);
    expect(copy.body).toMatch(/scanner/i);
    expect(copy.body).toMatch(/números primos/i);
    expect(copy.hint).toMatch(/placar/i);
    expect(copy.hint).toMatch(/tempo/i);
  });

  it("explains that step five selects a direction and confirms with scan", () => {
    const copy = ULAM_GALAXY_TUTORIAL_COPY[5];

    expect(copy.visual).toBeUndefined();
    expect(copy.title).toMatch(/diagonal dominante/i);
    expect(copy.body).toMatch(/direções possíveis/i);
    expect(copy.body).toMatch(/Analisar trajetória/i);
    expect(copy.hint).toMatch(/maior concentração de primos/i);
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
