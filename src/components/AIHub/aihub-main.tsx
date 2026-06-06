import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionGenerator } from "./question-generator";
import { ProgressDashboard } from "./progress-dashboard";
import { SyllabusManager } from "./syllabus-manager";
import { Lightbulb, BarChart3, BookOpen } from "lucide-react";

export function AIHubMain() {
  const [activeTab, setActiveTab] = useState("questions");
  const [subject, setSubject] = useState("Computer Science");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-foreground">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Hub</h1>
        <p className="text-muted-foreground">
          Personalized exam preparation with AI-powered question generation and answer evaluation
        </p>
      </div>

      {/* Subject Selector */}
      <div className="mb-6 p-4 rounded-lg bg-muted/40">
        <label className="block text-sm font-medium text-foreground mb-2">
          Subject
        </label>
        <div className="w-full md:w-48 px-3 py-2 border border-input rounded-md shadow-sm bg-background text-foreground">
          Computer Science
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            <span className="hidden sm:inline">Generate & Evaluate</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Progress</span>
          </TabsTrigger>
          <TabsTrigger value="syllabus" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Syllabus</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <QuestionGenerator subject={subject} />
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <ProgressDashboard subject={subject} />
        </TabsContent>

        <TabsContent value="syllabus" className="space-y-4">
          <SyllabusManager subject={subject} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
