import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionGenerator } from "./question-generator";
import { ProgressDashboard } from "./progress-dashboard";
import { SyllabusManager } from "./syllabus-manager";
import { AIHubGuide } from "./aihub-guide";
import { Activity, BarChart3, BookOpen, Lightbulb, ShieldCheck, Sparkles, Target } from "lucide-react";

const hubTabs = [
  {
    value: "questions",
    label: "Generate & Evaluate",
    shortLabel: "Practice",
    description: "Create exam questions and check handwritten answers.",
    icon: Lightbulb,
  },
  {
    value: "progress",
    label: "Progress",
    shortLabel: "Progress",
    description: "Track scores, attempts, and weak areas.",
    icon: BarChart3,
  },
  {
    value: "syllabus",
    label: "Syllabus",
    shortLabel: "Syllabus",
    description: "See unit coverage and topic mastery.",
    icon: BookOpen,
  },
];

export function AIHubMain() {
  const [activeTab, setActiveTab] = useState("questions");
  const subject = "Computer Science";
  const activeTabMeta = hubTabs.find((tab) => tab.value === activeTab) ?? hubTabs[0];

  return (
    <div className="ai-hub-container mx-auto max-w-6xl px-4 pb-10 text-foreground">
      <section className="ai-hub-hero mb-6 rounded-xl p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="ai-hub-kicker">
              <Sparkles className="h-4 w-4" />
              AI Hub workspace
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Practice, evaluate, improve.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              A focused AI study desk for generating university-style questions, reading handwritten answers, and turning every attempt into topic-wise progress.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              <span className="ai-hub-pill">
                <ShieldCheck className="h-3.5 w-3.5" />
                Protected session
              </span>
              <span className="ai-hub-pill">
                <Target className="h-3.5 w-3.5" />
                {subject}
              </span>
              <span className="ai-hub-pill">
                <Activity className="h-3.5 w-3.5" />
                Live evaluation
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {hubTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <div key={tab.value} className="ai-hub-stat-card rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4 text-primary" />
                    {tab.shortLabel}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{tab.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <AIHubGuide mode="active" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-6 rounded-xl border border-border/80 bg-card/75 p-2 shadow-sm backdrop-blur">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-transparent p-0">
            {hubTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-auto flex-col gap-1 rounded-lg px-2 py-3 text-center data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:flex-row sm:gap-2 sm:px-4"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{tab.shortLabel}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border/70 bg-background/65 px-4 py-3 text-sm shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{activeTabMeta.label}</p>
            <p className="text-muted-foreground">{activeTabMeta.description}</p>
          </div>
          <span className="ai-hub-pill w-fit text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            {subject}
          </span>
        </div>

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
