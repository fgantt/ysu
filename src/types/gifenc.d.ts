declare module 'gifenc' {
  export type Palette = number[][];
  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options: {
      palette?: Palette;
      delay?: number;
      repeat?: number;
    }): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): GifEncoder;
  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number): Palette;
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array;
}
