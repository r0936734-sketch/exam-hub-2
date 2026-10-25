import type { ExamTopic } from "./exam-modes";

export type McqQuestion = {
  id: string;
  topicId: string;
  topicTitle: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type QuestionSeed = Omit<McqQuestion, "id" | "topicId" | "topicTitle" | "correctIndex"> & {
  topics: string[];
  answer: string;
};

const BANK: QuestionSeed[] = [
  { topics: ["dsssb-awareness"], prompt: "Which constitutional body recommends the distribution of net tax proceeds between the Union and the States?", answer: "Finance Commission", options: ["Election Commission", "Finance Commission", "NITI Aayog", "Union Cabinet"], explanation: "Article 280 provides for the Finance Commission to recommend the distribution of certain tax revenues." },
  { topics: ["dsssb-reasoning"], prompt: "In a coded language, MANGO is written as NBOHP. How is LEMON written using the same rule?", answer: "MFNPO", options: ["KDLNM", "MFNPO", "MFMPO", "NENQP"], explanation: "Every letter is shifted one position forward: L→M, E→F, M→N, O→P, N→O." },
  { topics: ["dsssb-arithmetic"], prompt: "A quantity is increased by 20% and then reduced by 20%. Compared with its original value, it is:", answer: "4% lower", options: ["Unchanged", "4% lower", "4% higher", "8% lower"], explanation: "The net multiplier is 1.20 × 0.80 = 0.96, so the final value is 4% lower." },
  { topics: ["dsssb-hindi"], prompt: "‘राजपुत्र’ में कौन-सा समास है?", answer: "तत्पुरुष समास", options: ["द्वंद्व समास", "बहुव्रीहि समास", "तत्पुरुष समास", "अव्ययीभाव समास"], explanation: "राजा का पुत्र होने के कारण ‘राजपुत्र’ षष्ठी तत्पुरुष समास है." },
  { topics: ["dsssb-english"], prompt: "Choose the sentence with correct subject–verb agreement.", answer: "Neither the teacher nor the students were late.", options: ["Neither the teacher nor the students was late.", "Neither the teacher nor the students were late.", "Neither the teacher or the students were late.", "Neither the teacher nor the students is late yesterday."], explanation: "With neither/nor, the verb commonly agrees with the nearer subject; ‘students’ is plural." },
  { topics: ["dsssb-fundamentals", "dsssb-digital-logic", "ugc-architecture"], prompt: "Which representation has exactly one bit changed between successive integer values?", answer: "Gray code", options: ["BCD", "Gray code", "ASCII", "Excess-3"], explanation: "Gray code is designed so consecutive code words differ in a single bit." },
  { topics: ["dsssb-fundamentals", "dsssb-architecture", "ugc-architecture"], prompt: "Which memory is normally fastest in the memory hierarchy visible to a CPU core?", answer: "Registers", options: ["Main memory", "L3 cache", "Registers", "Solid-state storage"], explanation: "Registers are located in or immediately adjacent to the CPU execution units and are faster than cache and main memory." },
  { topics: ["dsssb-digital-logic", "ugc-discrete", "ugc-architecture"], prompt: "For a Boolean function of four variables, how many cells are present in its Karnaugh map?", answer: "16", options: ["4", "8", "16", "32"], explanation: "A Karnaugh map has one cell for each minterm, so it has 2⁴ = 16 cells." },
  { topics: ["dsssb-digital-logic", "ugc-architecture"], prompt: "Which flip-flop has a toggle behavior when both inputs are asserted?", answer: "JK flip-flop", options: ["SR flip-flop", "D flip-flop", "JK flip-flop", "T latch"], explanation: "A JK flip-flop toggles its output when J = K = 1." },
  { topics: ["dsssb-architecture", "ugc-architecture"], prompt: "Which addressing mode obtains the operand from the memory location held in a register?", answer: "Register indirect", options: ["Immediate", "Register direct", "Register indirect", "Indexed"], explanation: "In register-indirect addressing, the register contains the effective address of the operand." },
  { topics: ["dsssb-os", "ugc-system-os"], prompt: "Which scheduling policy can cause starvation unless aging is used?", answer: "Priority scheduling", options: ["Round robin", "First-come first-served", "Priority scheduling", "FIFO disk scheduling"], explanation: "Low-priority processes can wait indefinitely if higher-priority work keeps arriving; aging raises their priority over time." },
  { topics: ["dsssb-os", "ugc-system-os"], prompt: "A system is in a safe state if:", answer: "A sequence exists that lets every process finish.", options: ["No process is waiting for I/O.", "A sequence exists that lets every process finish.", "All resources are currently allocated.", "Every process has identical priority."], explanation: "A safe sequence is an ordering in which each process can obtain its remaining resources and complete." },
  { topics: ["dsssb-programming", "ugc-programming-graphics"], prompt: "In C, what is the time complexity of binary search on a sorted array?", answer: "O(log n)", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], explanation: "Binary search discards roughly half of the remaining search range at every step." },
  { topics: ["dsssb-programming", "ugc-programming-graphics"], prompt: "Which binding time associates a variable name with a memory location during program execution?", answer: "Run time", options: ["Language design time", "Compile time", "Link time", "Run time"], explanation: "A dynamic memory location is associated with a name at run time." },
  { topics: ["dsssb-oop", "ugc-programming-graphics"], prompt: "Which OOP principle allows a client to use a derived object through a base-class interface?", answer: "Polymorphism", options: ["Encapsulation", "Aggregation", "Polymorphism", "Composition"], explanation: "Subtype polymorphism permits a derived object to stand in for its base type." },
  { topics: ["dsssb-ds", "ugc-ds-algorithms"], prompt: "Which traversal of a binary search tree outputs keys in nondecreasing order?", answer: "Inorder traversal", options: ["Preorder traversal", "Postorder traversal", "Level-order traversal", "Inorder traversal"], explanation: "Inorder traversal visits left subtree, root, then right subtree; this is sorted for a BST." },
  { topics: ["dsssb-ds", "ugc-ds-algorithms"], prompt: "Which collision-resolution technique keeps all records inside the hash table itself?", answer: "Open addressing", options: ["Separate chaining", "Open addressing", "External sorting", "Balanced merging"], explanation: "Open addressing probes alternative slots in the same table; separate chaining stores linked buckets externally." },
  { topics: ["dsssb-algorithms", "ugc-ds-algorithms"], prompt: "Dijkstra’s algorithm is guaranteed to find shortest paths when edge weights are:", answer: "Non-negative", options: ["Distinct", "Non-negative", "Integers only", "Strictly positive and equal"], explanation: "Dijkstra’s greedy finalization fails when a path can later be improved through a negative-weight edge." },
  { topics: ["dsssb-algorithms", "ugc-ds-algorithms"], prompt: "Which problem-solving method stores solutions to overlapping subproblems?", answer: "Dynamic programming", options: ["Backtracking", "Dynamic programming", "Branch and bound", "Exhaustive enumeration"], explanation: "Dynamic programming saves subproblem results to avoid recomputing overlapping work." },
  { topics: ["dsssb-dbms", "ugc-dbms"], prompt: "A relation is in BCNF if, for every non-trivial functional dependency X → Y:", answer: "X is a superkey.", options: ["Y is a candidate key.", "X is a superkey.", "The relation has no foreign keys.", "Every attribute is prime."], explanation: "BCNF requires every determinant of a non-trivial dependency to be a superkey." },
  { topics: ["dsssb-dbms", "ugc-dbms"], prompt: "Which ACID property prevents partial effects of a failed transaction from becoming permanent?", answer: "Atomicity", options: ["Consistency", "Isolation", "Durability", "Atomicity"], explanation: "Atomicity makes a transaction all-or-nothing, so partial updates are rolled back on failure." },
  { topics: ["dsssb-networks", "ugc-networks"], prompt: "Which protocol maps an IPv4 address to a MAC address on a local network?", answer: "ARP", options: ["DNS", "ARP", "DHCP", "ICMP"], explanation: "Address Resolution Protocol (ARP) resolves an IPv4 address to a link-layer MAC address." },
  { topics: ["dsssb-networks", "ugc-networks"], prompt: "Which transport protocol provides reliable, ordered byte-stream delivery?", answer: "TCP", options: ["UDP", "IP", "TCP", "ARP"], explanation: "TCP uses sequence numbers, acknowledgements, retransmission, and flow control for reliable ordered delivery." },
  { topics: ["dsssb-web"], prompt: "Which HTTP method is defined as safe and idempotent for retrieving a representation?", answer: "GET", options: ["POST", "GET", "PATCH", "CONNECT"], explanation: "GET is intended for retrieval and repeating it should not change server state." },
  { topics: ["dsssb-se", "ugc-software-engineering"], prompt: "Which testing level focuses on interactions among integrated software modules?", answer: "Integration testing", options: ["Unit testing", "Integration testing", "Acceptance testing", "Regression testing"], explanation: "Integration testing specifically targets interfaces and interactions between combined modules." },
  { topics: ["dsssb-se", "ugc-software-engineering"], prompt: "Which UML diagram primarily models interactions between actors and system functions?", answer: "Use-case diagram", options: ["Class diagram", "State diagram", "Use-case diagram", "Deployment diagram"], explanation: "Use-case diagrams identify actors and the system services they interact with." },
  { topics: ["dsssb-toc", "ugc-toc-compilers"], prompt: "Which language class is recognized by a deterministic finite automaton?", answer: "Regular languages", options: ["Context-sensitive languages", "Regular languages", "Recursively enumerable languages", "All context-free languages"], explanation: "DFAs and NFAs recognize exactly the class of regular languages." },
  { topics: ["dsssb-toc", "ugc-toc-compilers"], prompt: "Which compiler phase groups a stream of characters into tokens?", answer: "Lexical analysis", options: ["Lexical analysis", "Syntax analysis", "Semantic analysis", "Code generation"], explanation: "The lexical analyzer converts character sequences into tokens for the parser." },
  { topics: ["dsssb-numerical"], prompt: "Which method approximates a root using the tangent at the current approximation?", answer: "Newton-Raphson method", options: ["Bisection method", "Newton-Raphson method", "Trapezoidal rule", "Simpson’s rule"], explanation: "Newton-Raphson updates x using x − f(x)/f′(x), the x-intercept of the tangent line." },
  { topics: ["dsssb-emerging", "ugc-ai"], prompt: "Which learning setting trains an agent from evaluative feedback rather than labelled input-output pairs?", answer: "Reinforcement learning", options: ["Supervised learning", "Unsupervised learning", "Reinforcement learning", "Transfer learning"], explanation: "Reinforcement learning optimizes actions from rewards or penalties received through interaction." },
  { topics: ["dsssb-pedagogy"], prompt: "In Vygotsky’s theory, the gap between independent performance and guided performance is the:", answer: "Zone of proximal development", options: ["Zone of proximal development", "Schema of accommodation", "Law of effect", "Operant schedule"], explanation: "The ZPD is the range of tasks a learner can perform with appropriate guidance but not yet alone." },
  { topics: ["ugc-discrete"], prompt: "For a connected undirected graph with n vertices, a spanning tree contains how many edges?", answer: "n − 1", options: ["n − 1", "n", "n + 1", "2n − 2"], explanation: "Every tree with n vertices has exactly n − 1 edges; a spanning tree includes all graph vertices." },
  { topics: ["ugc-discrete"], prompt: "Which relation property requires that whenever aRb and bRa, then a = b?", answer: "Antisymmetry", options: ["Reflexivity", "Symmetry", "Transitivity", "Antisymmetry"], explanation: "Antisymmetry states that mutual relatedness implies equality." },
  { topics: ["ugc-programming-graphics"], prompt: "Which transformation preserves shape and size but may change position and orientation?", answer: "Rotation", options: ["Scaling", "Shearing", "Rotation", "Projection"], explanation: "Rotation preserves distances and angles while changing an object’s orientation around a point or axis." },
];

function seededShuffle<T>(values: T[], seed: number) {
  const result = [...values];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const swapIndex = Math.floor((state / 233280) * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function isOptionSetSafe(seed: QuestionSeed) {
  const normalized = seed.options.map((option) => option.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== 4 || !normalized.includes(seed.answer.toLocaleLowerCase())) return false;
  const lengths = seed.options.map((option) => option.length);
  const answerLength = seed.answer.length;
  return answerLength >= Math.min(...lengths) * 0.55 && answerLength <= Math.max(...lengths) * 1.8;
}

export function buildMcqSet(topics: ExamTopic[], questionCount: number): McqQuestion[] {
  const selectedIds = new Set(topics.map((topic) => topic.id));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const eligible = BANK.filter((seed) => seed.topics.some((topicId) => selectedIds.has(topicId)) && isOptionSetSafe(seed));
  if (!eligible.length) return [];

  const result: McqQuestion[] = [];
  const targetPositions = Array.from({ length: questionCount }, (_, index) => index % 4);
  const shuffledSeeds = seededShuffle(eligible, Date.now());

  for (let index = 0; index < questionCount; index += 1) {
    const seed = shuffledSeeds[index % shuffledSeeds.length];
    const topicId = seed.topics.find((id) => selectedIds.has(id)) || topics[0].id;
    const topic = topicById.get(topicId) || topics[0];
    const distractors = seededShuffle(seed.options.filter((option) => option !== seed.answer), index + 11);
    const options = [...distractors];
    options.splice(targetPositions[index], 0, seed.answer);
    result.push({
      id: `${topicId}-${index}-${Date.now()}`,
      topicId,
      topicTitle: topic.title,
      prompt: seed.prompt,
      options,
      correctIndex: targetPositions[index],
      explanation: seed.explanation,
    });
  }
  return seededShuffle(result, Date.now() + 7).map((question, index) => ({
    ...question,
    correctIndex: question.options.indexOf(BANK.find((seed) => seed.prompt === question.prompt)?.answer || ""),
    id: `${question.id}-${index}`,
  }));
}

export function getCorrectOptionDistribution(questions: McqQuestion[]) {
  return questions.reduce<Record<string, number>>((distribution, question) => {
    const label = String.fromCharCode(65 + question.correctIndex);
    distribution[label] = (distribution[label] || 0) + 1;
    return distribution;
  }, {});
}
