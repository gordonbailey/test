import { fontFamily, loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { Scene1Hook } from "./Scene1Hook";
import { Scene2WhoAreThey } from "./Scene2WhoAreThey";
import { Scene3Opportunity } from "./Scene3Opportunity";
import { Scene4Solution } from "./Scene4Solution";
import { Scene5CTA } from "./Scene5CTA";

loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "700", "800"],
});

// Scene durations in frames (30fps)
const S1_START = 0;
const S1_DUR = 120; // 4s
const S2_START = 110;
const S2_DUR = 130; // ~4.3s
const S3_START = 230;
const S3_DUR = 140; // ~4.7s
const S4_START = 360;
const S4_DUR = 150; // 5s
const S5_START = 500;
const S5_DUR = 120; // 4s

const TOTAL = S5_START + S5_DUR; // 620 frames ~20.7s

const CrossFade: React.FC<{ start: number; dur: number; children: React.ReactNode }> = ({
  start,
  dur,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [start, start + 10, start + dur - 12, start + dur],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      <Sequence from={start} durationInFrames={dur}>
        {children}
      </Sequence>
    </AbsoluteFill>
  );
};

export const SuperDonorsVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily, background: "#0f0a1e" }}>
      <CrossFade start={S1_START} dur={S1_DUR}><Scene1Hook /></CrossFade>
      <CrossFade start={S2_START} dur={S2_DUR}><Scene2WhoAreThey /></CrossFade>
      <CrossFade start={S3_START} dur={S3_DUR}><Scene3Opportunity /></CrossFade>
      <CrossFade start={S4_START} dur={S4_DUR}><Scene4Solution /></CrossFade>
      <CrossFade start={S5_START} dur={S5_DUR}><Scene5CTA /></CrossFade>
    </AbsoluteFill>
  );
};

export { TOTAL as SUPER_DONORS_DURATION };
