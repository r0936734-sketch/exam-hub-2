/**
 * API service layer with placeholder functions for unimplemented features.
 * Server functions are called from api.server.ts and imported directly by routes.
 */

// Placeholder functions for other features (to be implemented)
export async function getStudentDashboard() {
  return {
    stats: { averageMarks: 0, totalTests: 0, currentRank: 0, totalStudents: 0 },
    recentScores: [],
  };
}

export async function getStudentProfile() {
  return { student: {}, stats: {}, performance: [], submissions: [] };
}

export async function getTests() {
  return [];
}

export async function getTestDetails(id: string) {
  return { test: {}, questions: [] };
}

export async function submitTestAnswers(testId: string, files: File[]) {
  return { ok: true, submissionId: `sub-${Date.now()}`, files: files.length, testId };
}

export async function getAdminDashboard() {
  return { stats: {}, topStudents: [], pending: [] };
}

export async function getPendingSubmissions() {
  return [];
}

export async function evaluateSubmission(id: string, marks: number, feedback: string) {
  return { ok: true, id, marks, feedback };
}

export async function getAllStudents() {
  return [];
}

export async function toggleStudentActive(id: string, active: boolean) {
  return { ok: true, id, active };
}

export async function createTest(payload: unknown) {
  return { ok: true, payload };
}
