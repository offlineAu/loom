import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUlid } from "@/lib/platform/ids";
import { TrackerInstanceDetail } from "@/components/tracker/tracker-instance-detail";

export const metadata: Metadata = {
  title: "Debt Tracker",
};

export default async function DebtInstancePage({ params }: PageProps<"/trackers/debt/[id]">) {
  const { id } = await params;

  if (!isUlid(id)) {
    notFound();
  }

  return <TrackerInstanceDetail id={id} templateKey="debt" basePath="/trackers/debt" />;
}
