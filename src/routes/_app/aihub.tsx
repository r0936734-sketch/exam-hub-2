import { createFileRoute } from "@tanstack/react-router";
import { AIHubAccess } from "@/components/AIHub/aihub-access";

export const Route = createFileRoute("/_app/aihub")({
  component: AIHubPage,
});

function AIHubPage() {
  return (
    <div className="min-h-screen bg-background py-8 text-foreground">
      <AIHubAccess />
    </div>
  );
}
