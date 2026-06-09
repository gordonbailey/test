import { Composition } from "remotion";
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../../types/constants";
import { SuperDonorsVideo, SUPER_DONORS_DURATION } from "./SuperDonors/SuperDonorsVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SuperDonors"
        component={SuperDonorsVideo}
        durationInFrames={SUPER_DONORS_DURATION}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{}}
      />
    </>
  );
};
