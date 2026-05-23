import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Circle, Search, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/syllabus")({ component: SyllabusPage });

type PrepLevel = "light" | "medium" | "complete";
type ProgressMap = Record<string, PrepLevel>;

const PREP_LEVELS: Array<{ value: PrepLevel; label: string; helper: string }> = [
  { value: "light", label: "Light", helper: "Studied once" },
  { value: "medium", label: "Medium", helper: "Practicing" },
  { value: "complete", label: "Complete", helper: "Exam ready" },
];

const SYLLABUS = [
  {
    id: "digital-logic-discrete",
    title: "Digital Logic, Circuits and Discrete Mathematical Structures",
    subtopics: [
      "Number systems",
      "Boolean algebra and logic gates",
      "Simplification of Boolean functions",
      "Combinational circuits",
      "Sequential circuits",
      "Memory circuits",
      "Sets, relations and functions",
      "Mathematical logic",
      "Combinatorics and recurrence relations",
      "Graph theory",
    ],
  },
  {
    id: "computer-organization",
    title: "Computer Organization and Architecture",
    subtopics: [
      "Stored program concept",
      "Components of a computer system",
      "Machine instruction, opcodes and operands",
      "Instruction cycle",
      "CPU organization and ALU",
      "Hardwired and micro programmed control unit",
      "General purpose and special purpose registers",
      "Memory organization and I/O organization",
      "Functioning of CPU",
      "Instruction formats and instruction types",
      "Addressing modes",
      "Common microprocessor instructions",
      "Multi-core architecture",
      "Multiprocessor and multicomputer",
    ],
  },
  {
    id: "data-structures-algorithm",
    title: "Data Structures and Algorithm",
    subtopics: [
      "Definition and types",
      "Linear structures",
      "Non-linear data structures",
      "Hashing and collision resolution techniques",
      "Searching and sorting",
      "Algorithms and analyzing algorithms",
      "Complexity of algorithms and growth of functions",
      "Performance measurements",
      "Advanced data structures",
      "Red-black trees, B-trees, binomial heaps and Fibonacci heaps",
      "Divide and conquer",
      "Greedy algorithms",
      "Optimal reliability allocation",
      "Knapsack",
      "Minimum spanning trees: Prim's and Kruskal's algorithms",
      "Single source shortest paths: Dijkstra's and Bellman Ford algorithms",
      "Dynamic programming",
      "All pair shortest paths: Warshal's and Floyd's algorithms",
      "Resource allocation problem",
      "Backtracking",
      "Branch and bound: travelling salesman, graph coloring, n-queen, Hamiltonian cycles and sum of subsets",
      "Algebraic computation and fast Fourier transform",
      "String matching",
      "Theory of NP-completeness",
      "Approximation algorithms and randomized algorithms",
    ],
  },
  {
    id: "c-programming",
    title: "Problem Solving Through C Programming",
    subtopics: [
      "Basic programming concepts",
      "Introduction to C programming language",
      "Programming in C",
    ],
  },
  {
    id: "object-oriented-techniques",
    title: "Object Oriented Techniques",
    subtopics: [
      "Object orientation",
      "Encapsulation and information hiding",
      "Polymorphism and genericity",
      "Object oriented modelling and UML",
      "Structural, behavioural and architectural modelling",
      "Object oriented analysis",
      "Object oriented design and object design",
      "Structured analysis and structured design (SA/SD)",
      "Jackson Structured Development (JSD)",
      "Object oriented programming style",
      "Introduction to Java",
      "Java Beans and Enterprise Java Beans (EJB)",
      "Java Swing",
      "Java as internet programming language",
      "Connectivity model, JDBC/ODBC bridge and servlets",
    ],
  },
  {
    id: "operating-system",
    title: "Operating System",
    subtopics: [
      "Definition, design goals and evolution",
      "Structure and functions of operating system",
      "Process management",
      "Memory management",
      "Concurrent processes",
      "File and secondary storage management",
      "UNIX and shell programming",
      "Windows programming",
    ],
  },
  {
    id: "dbms",
    title: "Database Management Systems",
    subtopics: [
      "Database systems",
      "View of data models",
      "Database languages",
      "DBMS architecture",
      "Database users and data independence",
      "ER modelling",
      "Relational model",
      "Introduction to SQL",
      "Relational database design",
      "Database security",
      "Transaction management",
      "Query processing and query optimization",
      "Concurrency control",
      "Recovery techniques",
    ],
  },
  {
    id: "computer-networks",
    title: "Computer Networks",
    subtopics: [
      "Network definition",
      "Network topologies and classifications",
      "Network protocol",
      "Layered network architecture",
      "OSI reference model overview",
      "TCP/IP protocol suite",
      "Data communication fundamentals and techniques",
      "Network switching techniques and access mechanisms",
      "Data link layer functions and protocol",
      "Multiple access protocol and networks",
      "Network layer functions and protocols",
      "Transport layer functions and protocols",
      "Application layer protocol overview",
    ],
  },
  {
    id: "software-engineering",
    title: "Software Engineering",
    subtopics: [
      "Definition and software development",
      "Life-cycle models",
      "CMM",
      "Software quality",
      "Role of metrics and measurement",
      "Requirements analysis and specification",
      "Software project planning",
      "Software architecture",
      "Software design and implementation",
      "Software testing and reliability",
    ],
  },
  {
    id: "internet-web-technology",
    title: "Internet Technology, Web Design and Web Technology",
    subtopics: [
      "Internet technology and protocol",
      "Internet architecture and internet network",
      "Services on internet and electronic mail",
      "Current trends on internet",
      "Web publishing and browsing",
      "HTML programming basics",
      "Interactivity tools",
      "Internet security management concepts",
      "Information privacy and copyright issues",
      "Web protocols, development strategies and applications",
      "Web project and team",
      "Web page designing",
      "Scripting",
      "Server side programming",
    ],
  },
  {
    id: "system-analysis-design",
    title: "System Analysis and Design",
    subtopics: [
      "Analysis and design of a system",
      "Documenting and evaluating the system",
      "Data modelling",
      "Development of information management system",
      "Implementation",
      "Testing and security aspects",
    ],
  },
  {
    id: "information-security-cyber-laws",
    title: "Information Security and Cyber Laws",
    subtopics: [
      "Distributed information systems",
      "Role of internet and web services",
      "Threats, attacks and assessing damages",
      "Security in mobile and wireless computing",
      "Security threats to e-commerce, e-governance and EDI",
      "Electronic payment systems, e-cash and credit/debit cards",
      "Physical security needs, disaster controls and entry controls",
      "Access control",
      "Model of cryptographic systems",
      "Design and implementation issues",
      "Policies and network security",
      "Attacks, intrusion monitoring and intrusion detection",
      "Security metrics, classification and benefits",
      "Information security and laws",
      "Ethics, data privacy and software privacy",
      "Overview and types of cyber crimes",
    ],
  },
  {
    id: "computer-graphics",
    title: "Computer Graphics",
    subtopics: [
      "Types of computer graphics",
      "Graphic displays",
      "Random scan displays",
      "Raster scan displays",
      "Frame buffer and video controller",
      "Line and circle generating algorithms",
      "Transformations",
      "Windowing and clipping",
      "Three dimensional graphics",
      "Curves and surfaces",
      "Hidden lines and surfaces",
    ],
  },
];

function progressKey(topicId: string, subtopic: string) {
  return `${topicId}::${subtopic}`;
}

function cookieName(userId: string) {
  return `lt_grade_syllabus_v2_${userId.replace(/[^a-z0-9_-]/gi, "_")}`;
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function writeCookie(name: string, value: ProgressMap) {
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function levelClasses(value: PrepLevel | undefined, option: PrepLevel) {
  if (value !== option) {
    return "border-border bg-background text-muted-foreground hover:text-foreground";
  }

  if (option === "light") return "border-amber-300 bg-amber-100 text-amber-700";
  if (option === "medium") return "border-blue-300 bg-blue-100 text-blue-700";
  return "border-emerald-300 bg-emerald-100 text-emerald-700";
}

function SyllabusPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressMap>({});
  const [query, setQuery] = useState("");

  const name = cookieName(user?.id || "student");

  useEffect(() => {
    try {
      const stored = readCookie(name);
      setProgress(stored ? (JSON.parse(decodeURIComponent(stored)) as ProgressMap) : {});
    } catch {
      setProgress({});
    }
  }, [name]);

  const setLevel = (key: string, value: PrepLevel) => {
    setProgress((current) => {
      const next = { ...current, [key]: value };
      writeCookie(name, next);
      return next;
    });
  };

  const allSubtopics = SYLLABUS.reduce((count, topic) => count + topic.subtopics.length, 0);
  const complete = Object.values(progress).filter((value) => value === "complete").length;
  const medium = Object.values(progress).filter((value) => value === "medium").length;
  const light = Object.values(progress).filter((value) => value === "light").length;

  const filteredSyllabus = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return SYLLABUS;

    return SYLLABUS.map((topic) => ({
      ...topic,
      subtopics: topic.subtopics.filter(
        (subtopic) =>
          topic.title.toLowerCase().includes(term) || subtopic.toLowerCase().includes(term),
      ),
    })).filter((topic) => topic.subtopics.length > 0);
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Computer Syllabus"
        description="Track every topic for UP LT Grade Mains Computer preparation."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Exam ready</p>
            <p className="mt-1 text-2xl font-semibold">{complete}/{allSubtopics}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Practicing</p>
            <p className="mt-1 text-2xl font-semibold">{medium}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Studied once</p>
            <p className="mt-1 text-2xl font-semibold">{light}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="mt-1 text-2xl font-semibold">
              {Math.round((complete / allSubtopics) * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 border-border/60">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topic or subtopic"
              className="h-10 w-full rounded-md border bg-background pl-9 pr-10 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-4">
        {filteredSyllabus.map((topic) => {
          const topicComplete = topic.subtopics.filter(
            (subtopic) => progress[progressKey(topic.id, subtopic)] === "complete",
          ).length;

          return (
            <Card key={topic.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <BookOpen className="size-4" />
                    </div>
                    <div>
                      <h2 className="font-semibold leading-tight">{topic.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {topicComplete}/{topic.subtopics.length} subtopics exam ready
                      </p>
                    </div>
                  </div>
                  <Badge variant={topicComplete === topic.subtopics.length ? "default" : "secondary"}>
                    {topicComplete === topic.subtopics.length ? "Complete" : "In progress"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-2">
                  {topic.subtopics.map((subtopic) => {
                    const key = progressKey(topic.id, subtopic);
                    const value = progress[key];

                    return (
                      <div
                        key={key}
                        className="grid gap-3 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[1fr_auto] lg:items-center"
                      >
                        <div className="flex items-start gap-2">
                          {value === "complete" ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                          ) : (
                            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                          )}
                          <p className="text-sm leading-snug">{subtopic}</p>
                        </div>

                        <RadioGroup
                          value={value || ""}
                          onValueChange={(next) => setLevel(key, next as PrepLevel)}
                          className="flex flex-wrap gap-1"
                        >
                          {PREP_LEVELS.map((level) => (
                            <label
                              key={level.value}
                              title={level.helper}
                              className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${levelClasses(
                                value,
                                level.value,
                              )}`}
                            >
                              <RadioGroupItem value={level.value} className="sr-only" />
                              {level.label}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
