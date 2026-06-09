import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const Scene5CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = spring({ fps, frame, delay: 5, config: { damping: 12, stiffness: 80 } });
  const titleFade = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const subtitleFade = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const statsFade = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });

  const pulseOpacity = 0.4 + 0.2 * Math.sin(frame * 0.12);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #0f1f5c 100%)",
        opacity: fadeIn,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orb */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)",
            opacity: pulseOpacity,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill className="flex flex-col items-center justify-center" style={{ gap: 0 }}>
        {/* GoFundMe wordmark placeholder */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
            borderRadius: 14,
            padding: "10px 28px",
            marginBottom: 36,
          }}
        >
          <span style={{ color: "#ffffff", fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>
            GoFundMe
          </span>
        </div>

        <h1
          style={{
            opacity: titleFade,
            color: "#ffffff",
            fontSize: 62,
            fontWeight: 800,
            margin: 0,
            marginBottom: 16,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          Super Donors
        </h1>

        <p
          style={{
            opacity: subtitleFade,
            color: "#c4b5fd",
            fontSize: 26,
            fontWeight: 400,
            margin: 0,
            marginBottom: 52,
            textAlign: "center",
            maxWidth: 620,
            lineHeight: 1.4,
          }}
        >
          Identify, engage, and retain the donors who drive nearly half of all donations
        </p>

        {/* KPI pills */}
        <div style={{ opacity: statsFade, display: "flex", gap: 24 }}>
          {[
            { value: "41%", label: "of GDV" },
            { value: "3–5×", label: "avg donation" },
            { value: "↑ LTV", label: "highest segment" },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(167,139,250,0.3)",
                borderRadius: 16,
                padding: "18px 32px",
                textAlign: "center",
              }}
            >
              <p style={{ color: "#ffffff", fontSize: 30, fontWeight: 800, margin: 0 }}>{stat.value}</p>
              <p style={{ color: "#94a3b8", fontSize: 15, margin: 0, marginTop: 4 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
