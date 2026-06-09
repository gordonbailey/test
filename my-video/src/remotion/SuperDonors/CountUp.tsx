import { CSSProperties } from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const CountUp: React.FC<{
  from: number;
  to: number;
  startFrame: number;
  durationFrames: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
  style?: CSSProperties;
}> = ({ from, to, startFrame, durationFrames, suffix = "", prefix = "", decimals = 0, className, style }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [startFrame, startFrame + durationFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <span className={className} style={style}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  );
};
