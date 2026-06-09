import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const steps = [
  {
    num: "01",
    title: "Identify",
    body: "ML model surfaces Super Donors from behavioral signals: frequency, cross-campaign giving, referral activity",
    color: "#7c3aed",
  },
  {
    num: "02",
    title: "Engage",
    body: "Personalised donor portal, impact reports, and early campaign access — make them feel like insiders",
    color: "#6366f1",
  },
  {
    num: "03",
    title: "Retain",
    body: "Smart re-activation nudges when 30/60/90-day lapse risk is detected. Right message, right moment",
    color: "#3b82f6",
  },
  {
    num: "04",
    title: "Grow GDV",
    body: "Even a 10% lift in Super Donor retention compounds into significant Gross Donation Volume uplift",
    color: "#06b6d4",
  },
];

const StepCard: React.FC<typeof steps[number] & { delay: number }> = ({ num, title, body, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ fps, frame, delay, config: { damping: 15, stiffness: 65 } });
  const fade = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity: fade,
        transform: `translateX(${(1 - enter) * -40}px)`,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        width: 560,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 18,
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {num}
      </div>
      <div>
        <p style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 4 }}>{title}</p>
        <p style={{ color: "#94a3b8", fontSize: 17, margin: 0, lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  );
};

export const Scene4Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const headerFade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

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
        <div style={{ opacity: headerFade, textAlign: "center" }}>
          <p style={{ color: "#a78bfa", fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0, marginBottom: 10 }}>
            The Product Strategy
          </p>
          <h2 style={{ color: "#ffffff", fontSize: 50, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            How we unlock the <span style={{ color: "#a78bfa" }}>41%</span>
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((s, i) => (
            <StepCard key={i} {...s} delay={15 + i * 22} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
