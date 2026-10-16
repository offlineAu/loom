import type { Metadata } from "next";
import { PageTitle, SecondaryText } from "@/components/loom/typography";
import { TrackerGallery } from "@/components/tracker/tracker-gallery";

export const metadata: Metadata = {
  title: "Trackers",
  description: "Browse every LOOM tracker by category.",
};

export default function TrackersPage() {
  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Trackers</PageTitle>
        <SecondaryText className="mt-1">
          Debt Tracker is available now. The rest are on the way.
        </SecondaryText>
      </div>
      <TrackerGallery />
    </div>
  );
}
