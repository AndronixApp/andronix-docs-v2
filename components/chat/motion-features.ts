// Motion's DOM animation features, loaded on demand by <ChatMotion> (LazyMotion), so /chat's
// first paint doesn't wait on them and no other docs page ever loads them.
import { domAnimation } from "motion/react";
export default domAnimation;
