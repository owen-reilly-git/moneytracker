import { ImageResponse } from "next/og";

const VARIANTS = {
  "192": { canvas: 192, letter: 108, maskable: false },
  "512": { canvas: 512, letter: 288, maskable: false },
  "512-maskable": { canvas: 512, letter: 200, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const variant = VARIANTS[size as keyof typeof VARIANTS];

  if (!variant) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Maskable icons must be full-bleed (no transparent corners) —
          // the OS applies its own mask (circle/squircle/etc) on top, so
          // the letter is sized down to stay inside the ~safe zone that
          // survives any mask shape.
          background: "#111827",
          color: "#ffffff",
          fontSize: variant.letter,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        M
      </div>
    ),
    { width: variant.canvas, height: variant.canvas },
  );
}
