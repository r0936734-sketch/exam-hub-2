import { createFileRoute } from "@tanstack/react-router";
import { AIHubAccess } from "@/components/AIHub/aihub-access";

export const Route = createFileRoute("/_app/aihub")({
  component: AIHubPage,
});

function AIHubPage() {
  return (
    <div className="ai-hub-shell min-h-screen py-6 text-foreground sm:py-8">
      <AIHubAccess />
    </div>
  );
}
