import { Composition } from "remotion";
import { BlinkPayDemo } from "./BlinkPayDemo";

export const BlinkPayVideoRoot = () => (
  <Composition
    id="BlinkPayDemo"
    component={BlinkPayDemo}
    durationInFrames={4950}
    fps={30}
    width={1920}
    height={1080}
  />
);
