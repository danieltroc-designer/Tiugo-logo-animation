declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Uint8Array | number[][];
        delay?: number;
        first?: boolean;
        transparent?: boolean;
        repeat?: number;
      },
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };

  export function quantize(
    data: Uint8Array,
    maxColors: number,
    options?: { format?: string },
  ): Uint8Array;

  export function applyPalette(
    data: Uint8Array,
    palette: Uint8Array,
    format?: string,
  ): Uint8Array;
}
