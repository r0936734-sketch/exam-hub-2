import { createFileRoute } from "@tanstack/react-router";
import { AIHubAccess } from "@/components/AIHub/aihub-access";

export const Route = createFileRoute("/_app/aihub")({
  component: AIHubPage,
});

function AIHubPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <AIHubAccess />
    </div>
  );
}
