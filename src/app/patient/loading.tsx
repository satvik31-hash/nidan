import { SkeletonList } from "@/components/ui";

// Skeleton loaders, not spinners. A spinner reads as broken; a skeleton
// reads as loading.
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-7 w-40" />
      <SkeletonList rows={5} />
    </div>
  );
}
