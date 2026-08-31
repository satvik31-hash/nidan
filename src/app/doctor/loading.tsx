import { SkeletonList } from "@/components/ui";

export default function Loading() {
  return (
    <div className="max-w-5xl space-y-4">
      <div className="skeleton h-7 w-56" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
      </div>
      <SkeletonList rows={5} />
    </div>
  );
}
