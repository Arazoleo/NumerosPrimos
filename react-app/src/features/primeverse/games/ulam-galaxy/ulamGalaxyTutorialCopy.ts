export const ULAM_GALAXY_TUTORIAL_STEPS = [1, 2, 3, 4, 5] as const;

export type UlamGalaxyTutorialStep =
  | 0
  | (typeof ULAM_GALAXY_TUTORIAL_STEPS)[number];

export type UlamGalaxyTutorialVisual =
  | "spiral"
  | "diagonal"
  | "direction"
  | "scanner";

export interface UlamGalaxyTutorialCopy {
  readonly title: string;
  readonly body: string;
  readonly example?: string;
  readonly hint?: string;
  readonly visual?: UlamGalaxyTutorialVisual;
}

export const ULAM_GALAXY_TUTORIAL_COPY: Readonly<
  Record<Exclude<UlamGalaxyTutorialStep, 0>, UlamGalaxyTutorialCopy>
> = {
  1: {
    title: "Analise a Galáxia de Ulam",
    body: "A espiral contém centenas de inteiros e, na sua formação, as diagonais concentram números primos. A sua missão é identificar qual diagonal contém mais números primos.",
    hint: "Você pode usar o scanner para facilitar a investigação de cada região!",
  },
  2: {
    title: "A espiral organiza os inteiros",
    body: "Os números partem de uma âncora e crescem ao seu redor formando uma espiral",
    example:
      "Aqui você pode observar que o número 1 é a âncora e os outros valores se organizam ao redor dele",
    visual: "spiral",
  },
  3: {
    title: "Os primos formam as diagonais",
    body: "Ao destacar apenas os primos na espiral, é possível observar que eles formam uma diagonal na espiral.",
    hint: "Observe os pontos destacados.",
    visual: "diagonal",
  },
  4: {
    title: "Marque a diagonal dominante",
    body: "Selecione a direção que contém a maior concentração de primos e clique em \"Analisar trajetória\".",
    visual: "direction",
  },
  5: {
    title: "Escaneie as regiões",
    body: "Confirme sua escolha com o scanner e avance pelas cinco regiões",
    hint: "Para maximar sua pontuação evite erros e seja ágil!",
    visual: "scanner",
  },
};

export function getUlamGalaxyTutorialCopy(
  step: UlamGalaxyTutorialStep,
): UlamGalaxyTutorialCopy | null {
  return step == 0 ? null : ULAM_GALAXY_TUTORIAL_COPY[step];
}
