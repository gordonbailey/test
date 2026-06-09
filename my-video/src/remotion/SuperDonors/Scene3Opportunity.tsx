import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CountUp } from "./CountUp";

export const Scene3Opportunity: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const barEnter = spring({ fps, frame, delay: 20, config: { damping: 18, stiffness: 60 } });
  const bar2Enter = spring({ fps, frame, delay: 45, config: { damping: 18, stiffness: 60 } });
  const insightFade = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });

  const barMaxWidth = 480;

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

      <AbsoluteFill className="flex flex-col items-center justify-center" style={{ gap: 0 }}>
        <p style={{ color: "#a78bfa", fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
          The Opportunity
        </p>
        <h2 style={{ color: "#ffffff", fontSize: 50, fontWeight: 800, margin: 0, marginBottom: 48, letterSpacing: "-0.02em" }}>
          A small group, an outsized impact
        </h2>

        {/* Bar chart */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 640 }}>
          {/* Super donors bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#a78bfa", fontSize: 20, fontWeight: 700 }}>Super Donors</span>
              <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 800 }}>
                <CountUp from={0} to={41} startFrame={20} durationFrames={40} suffix="% of GDV" />
              </span>
            </div>
            <div style={{ height: 44, background: "rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: barMaxWidth * 0.41 * barEnter,
                  background: "linear-gradient(90deg, #7c3aed, #6366f1)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 12,
                }}
              />
            </div>
            <p style={{ color: "#c4b5fd", fontSize: 15, marginTop: 6 }}>~top 5–10% of donor base by frequency</p>
          </div>

          {/* Rest of donors bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#94a3b8", fontSize: 20, fontWeight: 700 }}>All other donors</span>
              <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 800 }}>
                <CountUp from={0} to={59} startFrame={45} durationFrames={40} suffix="% of GDV" />
              </span>
            </div>
            <div style={{ height: 44, background: "rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: barMaxWidth * 0.59 * bar2Enter,
                  background: "linear-gradient(90deg, #334155, #475569)",
                  borderRadius: 8,
                }}
              />
            </div>
            <p style={{ color: "#64748b", fontSize: 15, marginTop: 6 }}>~90–95% of donor base</p>
          </div>
        </div>

        {/* Insight callout */}
        <div
          style={{
            opacity: insightFade,
            marginTop: 44,
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.5)",
            borderRadius: 14,
            padding: "18px 32px",
            maxWidth: 640,
            textAlign: "center",
          }}
        >
          <p style={{ color: "#e2d9f3", fontSize: 20, margin: 0, lineHeight: 1.5 }}>
            Retaining and re-activating Super Donors is the{" "}
            <span style={{ color: "#a78bfa", fontWeight: 700 }}>highest-leverage growth lever</span>{" "}
            available to GoFundMe today
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
