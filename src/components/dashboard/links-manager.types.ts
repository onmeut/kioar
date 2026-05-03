import type { IconKey } from "@/lib/link-icons";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

export type EditableLink = {
  id: string;
  label: string;
  url: string;
  description: string | null;
  imageUrl: string | null;
  iconKey: IconKey | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
};
