declare module 'gifenc' {
  export function quantize(data: Uint8ClampedArray | Uint8Array, maxColors: number): number[][]
  export function applyPalette(data: Uint8ClampedArray | Uint8Array, palette: number[][]): Uint8Array

  interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; repeat?: number; first?: boolean }
    ): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(opts?: { auto?: boolean }): GIFEncoderInstance
}
