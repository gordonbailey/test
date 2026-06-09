import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const traits = [
  { icon: "💳", label: "Give repeatedly across", highlight: "multiple campaigns" },
  { icon: "💰", label: "Average donation", highlight: "3–5× higher" },
  { icon: "📣", label: "Organically refer", highlight: "friends & family" },
  { icon: "🔁", label: "Return year after year —", highlight: "highest LTV segment" },
];

const TraitCard: React.FC<{ icon: string; label: string; highlight: string; delay: number }> = ({
  icon,
  label,
  highlight,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ fps, frame, delay, config: { damping: 14, stiffness: 70 } });
  const fade = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity: fade,
        transform: `translateY(${(1 - enter) * 40}px)`,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(167,139,250,0.25)",
        borderRadius: 16,
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        width: 500,
      }}
    >
      <span style={{ fontSize: 36 }}>{icon}</span>
      <p style={{ color: "#e2d9f3", fontSize: 20, lineHeight: 1.4, margin: 0 }}>
        {label} <span style={{ color: "#a78bfa", fontWeight: 700 }}>{highlight}</span>
      </p>
    </div>
  );
};

export const Scene2WhoAreThey: React.FC = () => {
  const frame = useCurrentFrame();
  const titleFade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #0f1f5c 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <AbsoluteFill className="flex flex-col items-center justify-center" style={{ gap: 32 }}>
        <div style={{ opacity: titleFade, textAlign: "center", marginBottom: 12 }}>
          <p style={{ color: "#a78bfa", fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0, marginBottom: 10 }}>
            Who Are They?
          </p>
          <h2 style={{ color: "#ffffff", fontSize: 52, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Meet the <span style={{ color: "#a78bfa" }}>Super Donor</span>
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {traits.map((t, i) => (
            <TraitCard key={i} {...t} delay={15 + i * 18} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
