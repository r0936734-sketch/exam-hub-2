// Dummy data for the entire platform. Replace with API responses later.

export const dummyStudent = {
  id: "STU2024001",
  username: "alex_morgan",
  name: "Alex Morgan",
  email: "alex.morgan@example.edu",
  avatar: "",
  joinedAt: "2024-01-15",
  classGroup: "Grade 12 - Science",
};

export const dummyAdmin = {
  id: "ADM001",
  username: "admin",
  name: "Dr. Reyes",
  email: "reyes@example.edu",
};

export const dummyStats = {
  averageMarks: 82.4,
  totalTests: 14,
  currentRank: 7,
  totalStudents: 248,
};

export const dummyRecentScores = [
  { id: "t1", title: "Algebra II Midterm", score: 88, total: 100, date: "2024-05-12" },
  { id: "t2", title: "Organic Chemistry", score: 76, total: 100, date: "2024-05-05" },
  { id: "t3", title: "Mechanics Quiz", score: 92, total: 100, date: "2024-04-28" },
  { id: "t4", title: "English Literature", score: 81, total: 100, date: "2024-04-20" },
];

export const dummyPerformance = [
  { month: "Jan", score: 72 },
  { month: "Feb", score: 75 },
  { month: "Mar", score: 78 },
  { month: "Apr", score: 81 },
  { month: "May", score: 86 },
  { month: "Jun", score: 88 },
];

export const dummyTests = [
  {
    id: "test-001",
    title: "Calculus — Differentiation",
    subject: "Mathematics",
    totalQuestions: 12,
    deadline: "2024-06-20T23:59:00",
    status: "pending" as const,
    description: "Covers limits, derivatives, and chain rule problems.",
  },
  {
    id: "test-002",
    title: "Thermodynamics Fundamentals",
    subject: "Physics",
    totalQuestions: 10,
    deadline: "2024-06-25T23:59:00",
    status: "pending" as const,
    description: "Laws of thermodynamics with applied problems.",
  },
  {
    id: "test-003",
    title: "Cell Biology Assessment",
    subject: "Biology",
    totalQuestions: 15,
    deadline: "2024-06-18T23:59:00",
    status: "submitted" as const,
    description: "Comprehensive cell structure and function.",
  },
  {
    id: "test-004",
    title: "Modern Indian History",
    subject: "History",
    totalQuestions: 8,
    deadline: "2024-07-01T23:59:00",
    status: "pending" as const,
    description: "Independence movement and post-colonial era.",
  },
];

export const dummyQuestions = [
  {
    id: "q1",
    number: 1,
    text: "Find the derivative of f(x) = 3x⁴ − 2x² + 7x − 5 and evaluate at x = 2.",
    image: null as string | null,
    marks: 5,
  },
  {
    id: "q2",
    number: 2,
    text: "Using the chain rule, differentiate g(x) = sin(2x² + 1). Show all steps.",
    image: null,
    marks: 5,
  },
  {
    id: "q3",
    number: 3,
    text: "Refer to the graph below. Identify the intervals where the function is increasing and decreasing.",
    image: "https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=800&q=80",
    marks: 8,
  },
  {
    id: "q4",
    number: 4,
    text: "Prove that the derivative of ln(x) is 1/x using first principles.",
    image: null,
    marks: 7,
  },
];

export const dummyLeaderboard = Array.from({ length: 25 }).map((_, i) => ({
  rank: i + 1,
  userId: i === 6 ? "STU2024001" : `STU2024${String(100 + i).padStart(3, "0")}`,
  username:
    i === 6
      ? "alex_morgan"
      : [
          "priya_singh",
          "marcus_lee",
          "emma_chen",
          "raj_patel",
          "sofia_reyes",
          "liam_wong",
          "alex_morgan",
          "noah_kim",
          "ava_garcia",
          "elijah_brown",
          "mia_johnson",
          "lucas_davis",
          "isabella_lopez",
          "ethan_wilson",
          "amelia_taylor",
          "james_anderson",
          "harper_thomas",
          "benjamin_moore",
          "evelyn_jackson",
          "henry_white",
          "abigail_harris",
          "alexander_clark",
          "emily_lewis",
          "michael_walker",
          "ella_hall",
        ][i],
  averageScore: Math.round((95 - i * 0.7 + Math.random() * 2) * 10) / 10,
  testsAttempted: 14 + Math.floor(Math.random() * 6),
}));

export const dummySubmissions = [
  {
    id: "sub-001",
    testTitle: "Algebra II Midterm",
    date: "2024-05-12",
    score: 88,
    total: 100,
    status: "evaluated" as const,
  },
  {
    id: "sub-002",
    testTitle: "Organic Chemistry",
    date: "2024-05-05",
    score: 76,
    total: 100,
    status: "evaluated" as const,
  },
  {
    id: "sub-003",
    testTitle: "Mechanics Quiz",
    date: "2024-04-28",
    score: 92,
    total: 100,
    status: "evaluated" as const,
  },
  {
    id: "sub-004",
    testTitle: "Cell Biology Assessment",
    date: "2024-06-15",
    score: null,
    total: 100,
    status: "pending" as const,
  },
];

export const dummyAdminStats = {
  totalStudents: 248,
  totalSubmissions: 1842,
  pendingEvaluations: 37,
  publishedTests: 24,
};

export const dummyPendingSubmissions = [
  {
    id: "psub-001",
    studentName: "Priya Singh",
    studentId: "STU2024101",
    testTitle: "Calculus — Differentiation",
    submittedAt: "2024-06-15T14:22:00",
    files: 3,
  },
  {
    id: "psub-002",
    studentName: "Marcus Lee",
    studentId: "STU2024102",
    testTitle: "Thermodynamics Fundamentals",
    submittedAt: "2024-06-15T16:45:00",
    files: 2,
  },
  {
    id: "psub-003",
    studentName: "Emma Chen",
    studentId: "STU2024103",
    testTitle: "Calculus — Differentiation",
    submittedAt: "2024-06-16T09:10:00",
    files: 4,
  },
];

export const dummyAllStudents = Array.from({ length: 18 }).map((_, i) => ({
  id: `STU2024${String(100 + i).padStart(3, "0")}`,
  username: [
    "priya_singh",
    "marcus_lee",
    "emma_chen",
    "raj_patel",
    "sofia_reyes",
    "liam_wong",
    "alex_morgan",
    "noah_kim",
    "ava_garcia",
    "elijah_brown",
    "mia_johnson",
    "lucas_davis",
    "isabella_lopez",
    "ethan_wilson",
    "amelia_taylor",
    "james_anderson",
    "harper_thomas",
    "benjamin_moore",
  ][i],
  email: `student${i + 1}@example.edu`,
  active: i % 5 !== 4,
  joinedAt: `2024-0${(i % 5) + 1}-${10 + (i % 18)}`,
}));
