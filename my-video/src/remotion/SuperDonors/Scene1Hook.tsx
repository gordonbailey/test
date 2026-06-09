import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CountUp } from "./CountUp";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const statScale = spring({ fps, frame, delay: 15, config: { damping: 12, stiffness: 80 } });
  const subtitleFade = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const lineFade = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #0f1f5c 100%)",
        opacity: fadeIn,
      }}
    >
      {/* Subtle grid overlay */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <AbsoluteFill className="flex flex-col items-center justify-center">
        {/* Eyebrow */}
        <p
          style={{
            opacity: fadeIn,
            color: "#a78bfa",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          GoFundMe · Super Donors
        </p>

        {/* Big stat */}
        <div
          style={{
            transform: `scale(${statScale})`,
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <CountUp
            from={0}
            to={41}
            startFrame={15}
            durationFrames={45}
            suffix="%"
            style={{
              fontSize: 200,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          />
        </div>

        {/* Divider line */}
        <div
          style={{
            width: 600 * lineFade,
            height: 3,
            background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
            borderRadius: 2,
            marginTop: 16,
            marginBottom: 28,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            opacity: subtitleFade,
            color: "#e2d9f3",
            fontSize: 32,
            fontWeight: 400,
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          of GoFundMe's Gross Donation Volume comes from{" "}
          <span style={{ color: "#a78bfa", fontWeight: 700 }}>one small group of donors</span>
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
