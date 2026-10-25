export type ExamModeId = "lt-grade" | "dsssb-tgt-cs" | "ugc-net-cs";

export type ExamTopic = {
  id: string;
  title: string;
  subtopics: string[];
  section?: string;
};

export type ExamMode = {
  id: ExamModeId;
  shortTitle: string;
  title: string;
  format: "descriptive" | "objective";
  description: string;
  syllabus: ExamTopic[];
};

const LT_GRADE_SYLLABUS: ExamTopic[] = [
  { id: "digital-discrete", title: "Digital Logic, Circuits and Discrete Structures", subtopics: ["Number systems", "Boolean algebra and logic gates", "Combinatorics and recurrence relations", "Graph theory"] },
  { id: "computer-architecture", title: "Computer Organization and Architecture", subtopics: ["Instruction cycle", "CPU organization and ALU", "Memory and I/O organization", "Addressing modes"] },
  { id: "data-structures-algorithms", title: "Data Structures and Algorithms", subtopics: ["Linear and non-linear structures", "Hashing", "Searching and sorting", "Algorithm design techniques", "Complexity and NP-completeness"] },
  { id: "programming-oop", title: "Programming and Object-Oriented Techniques", subtopics: ["C programming", "Java", "Object-oriented modelling", "UML", "JDBC and servlets"] },
  { id: "operating-systems", title: "Operating Systems", subtopics: ["Process management", "Memory management", "Concurrency", "File systems", "UNIX and shell programming"] },
  { id: "dbms", title: "Database Management Systems", subtopics: ["ER modelling", "Relational model and SQL", "Database design", "Transactions", "Concurrency and recovery"] },
  { id: "networks-web", title: "Computer Networks and Web Technology", subtopics: ["OSI and TCP/IP", "Data communication", "Network protocols", "HTML", "Server-side programming"] },
  { id: "software-engineering", title: "Software Engineering and System Design", subtopics: ["Life-cycle models", "Requirements", "Software architecture", "Testing and reliability", "System analysis"] },
  { id: "security", title: "Information Security and Cyber Laws", subtopics: ["Threats and attacks", "E-commerce security", "Cryptography", "Cyber laws", "Privacy"] },
];

const DSSSB_SYLLABUS: ExamTopic[] = [
  { id: "dsssb-awareness", section: "Section A · General", title: "General Awareness", subtopics: ["National and international current affairs", "History, geography, polity and economy", "Delhi government, schemes, history and culture", "Awards, sports, books and important days", "Basic science and environment"] },
  { id: "dsssb-reasoning", section: "Section A · General", title: "Reasoning", subtopics: ["Analogy, classification and series", "Coding-decoding and blood relations", "Ranking, syllogism and Venn diagrams", "Puzzles and seating arrangement", "Non-verbal reasoning"] },
  { id: "dsssb-arithmetic", section: "Section A · General", title: "Arithmetical & Numerical Ability", subtopics: ["Number system and simplification", "Percentage, ratio and average", "Profit and loss, interest", "Time-work and time-speed-distance", "Mensuration, algebra and data interpretation"] },
  { id: "dsssb-hindi", section: "Section A · General", title: "Hindi Language & Comprehension", subtopics: ["अपठित गद्यांश", "संधि, समास, उपसर्ग-प्रत्यय", "पर्यायवाची, विलोम, मुहावरे", "वाक्य शुद्धि और व्याकरण", "भाषा शिक्षण"] },
  { id: "dsssb-english", section: "Section A · General", title: "English Language & Comprehension", subtopics: ["Reading comprehension and cloze", "Error spotting and sentence improvement", "Voice and narration", "Para jumbles and grammar", "Vocabulary and phrases"] },
  { id: "dsssb-fundamentals", section: "Section B · Computer Science", title: "Computer Fundamentals", subtopics: ["Computer generations and types", "Hardware, software and I/O", "Memory hierarchy", "Number systems", "ASCII and Unicode"] },
  { id: "dsssb-digital-logic", section: "Section B · Computer Science", title: "Digital Logic", subtopics: ["Boolean algebra and gates", "K-maps", "Combinational circuits", "Sequential circuits", "Flip-flops and multiplexers"] },
  { id: "dsssb-architecture", section: "Section B · Computer Science", title: "Computer Organization & Architecture", subtopics: ["CPU and registers", "Instruction cycle", "Addressing modes", "Cache and virtual memory", "Pipelining"] },
  { id: "dsssb-os", section: "Section B · Computer Science", title: "Operating Systems", subtopics: ["Scheduling and threads", "Synchronization and deadlocks", "Paging and segmentation", "File systems", "Disk scheduling"] },
  { id: "dsssb-programming", section: "Section B · Computer Science", title: "Programming Fundamentals", subtopics: ["C, C++, Java and Python", "Control structures", "Functions and recursion", "Arrays, strings and pointers", "File handling"] },
  { id: "dsssb-oop", section: "Section B · Computer Science", title: "Object-Oriented Programming", subtopics: ["Classes and objects", "Inheritance and polymorphism", "Encapsulation and abstraction", "Constructors", "Exception handling"] },
  { id: "dsssb-ds", section: "Section B · Computer Science", title: "Data Structures", subtopics: ["Arrays, lists, stacks and queues", "Trees and heaps", "Graphs", "Hashing"] },
  { id: "dsssb-algorithms", section: "Section B · Computer Science", title: "Algorithms", subtopics: ["Sorting and searching", "Time and space complexity", "Divide and conquer", "Greedy and dynamic programming", "Graph algorithms"] },
  { id: "dsssb-dbms", section: "Section B · Computer Science", title: "Database Management Systems", subtopics: ["ER and relational models", "Relational algebra", "Normalization", "SQL", "Transactions and concurrency"] },
  { id: "dsssb-networks", section: "Section B · Computer Science", title: "Computer Networks", subtopics: ["OSI and TCP/IP", "Switching and routing", "IP addressing", "TCP/IP protocols", "Network security"] },
  { id: "dsssb-web", section: "Section B · Computer Science", title: "Web Technologies", subtopics: ["HTML, CSS and JavaScript", "Client-server concepts", "Browsers and servers"] },
  { id: "dsssb-se", section: "Section B · Computer Science", title: "Software Engineering", subtopics: ["SDLC", "Requirements", "Design", "Testing", "Maintenance and UML"] },
  { id: "dsssb-toc", section: "Section B · Computer Science", title: "Theory of Computation & Compilers", subtopics: ["Finite automata", "Regular expressions", "Grammars", "Compiler phases"] },
  { id: "dsssb-numerical", section: "Section B · Computer Science", title: "Numerical Methods", subtopics: ["Interpolation", "Numerical equations", "Integration", "Differentiation"] },
  { id: "dsssb-emerging", section: "Section B · Computer Science", title: "Emerging Topics", subtopics: ["Cyber security and laws", "AI/ML", "Cloud and IoT", "E-governance", "Multimedia and office tools"] },
  { id: "dsssb-pedagogy", section: "Section B · Computer Science", title: "Pedagogy of Computer Science", subtopics: ["Teaching strategies", "Lesson planning", "Assessment", "Learning theories", "Inclusive education and ICT"] },
];

const UGC_NET_SYLLABUS: ExamTopic[] = [
  { id: "ugc-discrete", title: "Unit 1 · Discrete Structures and Optimization", subtopics: ["Logic, sets and relations", "Counting, induction and probability", "Group theory", "Graph theory", "Boolean algebra and optimization"] },
  { id: "ugc-architecture", title: "Unit 2 · Computer System Architecture", subtopics: ["Digital logic circuits", "Data representation", "Computer arithmetic", "Memory organization", "CPU and I/O organization"] },
  { id: "ugc-programming-graphics", title: "Unit 3 · Programming Languages and Computer Graphics", subtopics: ["Language design and translation", "Programming paradigms", "Data types and binding", "Computer graphics", "2D and 3D transformations"] },
  { id: "ugc-dbms", title: "Unit 4 · Database Management Systems", subtopics: ["Architecture and data models", "ER and relational models", "SQL and normalization", "Transactions and recovery", "Distributed databases"] },
  { id: "ugc-system-os", title: "Unit 5 · System Software and Operating Systems", subtopics: ["Assemblers, loaders and linkers", "Compiler basics", "Process and thread management", "Memory and storage", "Synchronization and deadlocks"] },
  { id: "ugc-software-engineering", title: "Unit 6 · Software Engineering", subtopics: ["Process models", "Requirements engineering", "Project management", "Design and architecture", "Testing and quality"] },
  { id: "ugc-ds-algorithms", title: "Unit 7 · Data Structures and Algorithms", subtopics: ["Linear and non-linear structures", "Sorting and searching", "Complexity", "Design techniques", "NP-completeness and approximation"] },
  { id: "ugc-toc-compilers", title: "Unit 8 · Theory of Computation and Compilers", subtopics: ["Formal languages and automata", "Regular languages", "Context-free languages", "Turing machines and decidability", "Compiler design"] },
  { id: "ugc-networks", title: "Unit 9 · Data Communication and Computer Networks", subtopics: ["Signals and transmission", "Data link layer", "Network layer", "Transport layer", "Application protocols and security"] },
  { id: "ugc-ai", title: "Unit 10 · Artificial Intelligence", subtopics: ["Agents and search", "Knowledge representation", "Machine learning", "Natural language processing", "Expert systems and robotics"] },
];

export const EXAM_MODES: Record<ExamModeId, ExamMode> = {
  "lt-grade": { id: "lt-grade", shortTitle: "LT Grade", title: "UP LT Grade Computer", format: "descriptive", description: "Mains-style descriptive answer writing with the LT Grade Computer syllabus.", syllabus: LT_GRADE_SYLLABUS },
  "dsssb-tgt-cs": { id: "dsssb-tgt-cs", shortTitle: "DSSSB TGT CS", title: "DSSSB TGT Computer Science", format: "objective", description: "Objective practice across Section A and the Computer Science section.", syllabus: DSSSB_SYLLABUS },
  "ugc-net-cs": { id: "ugc-net-cs", shortTitle: "UGC NET CS", title: "UGC NET Computer Science & Applications", format: "objective", description: "Advanced, concept-led objective practice aligned to the 10 UGC NET units.", syllabus: UGC_NET_SYLLABUS },
};

export const EXAM_MODE_LIST = Object.values(EXAM_MODES);

export function getExamMode(id: string | null | undefined): ExamMode {
  return EXAM_MODES[id as ExamModeId] || EXAM_MODES["lt-grade"];
}
