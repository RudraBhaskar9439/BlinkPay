import { Composition } from "remotion";
import { BlinkPayDemo } from "./BlinkPayDemo";
import { BlinkPayStory } from "./BlinkPayStory";

export const BlinkPayVideoRoot = () => (
  <>
    <Composition
      id="BlinkPayDemo"
      component={BlinkPayDemo}
      durationInFrames={4950}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="BlinkPayStory"
      component={BlinkPayStory}
      durationInFrames={5250}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
