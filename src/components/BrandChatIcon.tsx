import { cn } from "@/lib/utils";

type BrandChatIconProps = {
  className?: string;
};

export default function BrandChatIcon({ className }: BrandChatIconProps) {
  return <img src="/favicon.svg" alt="" aria-hidden="true" className={cn("shrink-0", className)} />;
}
