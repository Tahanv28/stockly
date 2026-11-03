import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon for iPhone ("Add to Home Screen").
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#187a64" }}>
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
          <path d="m3 8 9 5 9-5M12 13v8" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
