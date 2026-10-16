import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/loom/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button render={<Link href="/" />}>
            Back to home
          </Button>
        }
      />
    </div>
  );
}
