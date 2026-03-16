import { Container } from "@/components/layout/container";

function LoadingCard({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-neutral-200 bg-white/80 ${className}`}
    />
  );
}

export default function AdminLoading() {
  return (
    <Container className="space-y-8">
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-8 w-72 animate-pulse rounded-full bg-neutral-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LoadingCard className="h-28" />
        <LoadingCard className="h-28" />
        <LoadingCard className="h-28" />
        <LoadingCard className="h-28" />
      </div>

      <LoadingCard className="h-56" />
      <LoadingCard className="h-56" />
    </Container>
  );
}
