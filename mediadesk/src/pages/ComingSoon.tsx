import { PageHeader } from "@/components/ui";

// Temporary page for screens built in later stages. Each is replaced by the real page.
export default function ComingSoon({ title, stage }: { title: string; stage: number }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-2xl border border-dashed border-charcoal-600 p-10 text-center">
        <p className="text-sm text-fog-300">This page is not built yet. It arrives in Stage {stage} of 4.</p>
      </div>
    </>
  );
}
