import type { IconKey } from "@/lib/link-icons";

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
};
