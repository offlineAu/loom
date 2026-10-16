import Link from "next/link";
import { ShieldCheck, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, SecondaryText, SectionTitle, Body } from "@/components/loom/typography";
import { TrackerGallery } from "@/components/tracker/tracker-gallery";

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Start instantly",
    body: "No account required. Open a tracker and start entering data right away.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    body: "Your data is saved on your device first, so a spotty connection never blocks you.",
  },
  {
    icon: ShieldCheck,
    title: "Yours when you're ready",
    body: "Create a free account any time to back up your trackers and use them on another device.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="space-y-5 pt-4 text-center sm:pt-10">
        <PageTitle className="mx-auto max-w-2xl text-3xl sm:text-4xl">
          Reusable trackers for money, business, and productivity.
        </PageTitle>
        <SecondaryText className="mx-auto max-w-xl text-base">
          LOOM is a public tracker platform. Pick a tracker, start using it immediately, and
          decide later whether to create an account to keep it backed up.
        </SecondaryText>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" render={<Link href="/trackers/debt" />}>
            Start Debt Tracker
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/trackers" />}>
            Browse all trackers
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Why LOOM">
        {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <SectionTitle className="text-base">{title}</SectionTitle>
            <Body className="mt-1 text-muted-foreground">{body}</Body>
          </div>
        ))}
      </section>

      <section aria-labelledby="gallery-heading">
        <div className="mb-4 flex items-baseline justify-between">
          <SectionTitle id="gallery-heading" className="text-xl">
            Every tracker
          </SectionTitle>
        </div>
        <TrackerGallery />
      </section>
    </div>
  );
}
