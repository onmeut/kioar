import { ImageResponse } from "next/og"

export const size = {
  width: 512,
  height: 512,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, rgb(24, 92, 84), rgb(190, 228, 213), rgb(245, 229, 199))",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 92,
            border: "2px solid rgba(255,255,255,0.45)",
            background: "rgba(255,255,255,0.22)",
            backdropFilter: "blur(10px)",
          }}
        />
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 90,
            background: "rgba(7, 29, 28, 0.86)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 160,
            fontWeight: 900,
          }}
        >
          ک
        </div>
      </div>
    ),
    size
  )
}
