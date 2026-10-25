import { createServerFn } from "@tanstack/react-start";
import { connectToDatabase } from "@/server/db";
import {
  createUser,
  deleteStudent,
  getAllStudents,
  updateStudentActive,
  updateUserAvgMarks,
} from "@/server/user";
import { initializeDefaultAdmin } from "@/server/init";
import { cleanupExpiredTestsAndImages, deleteTestFilesAndSubmissions } from "@/server/cleanup";
import { ObjectId } from "mongodb";
import { requireSession } from "@/server/session";

type CreateStudentInput = {
  token: string;
  name: string;
  password: string;
};

type NoticeInput = {
  token: string;
  text: string;
};

export const createStudentServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: CreateStudentInput) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);

      const name = data.name.trim();
      const password = data.password.trim();

      if (!name || !password) {
        throw new Error("name and password are required");
      }

      const user = await createUser(db, {
        name,
        password,
        role: "student",
      });

      return {
        userId: user.userId,
        name: user.name,
        password: user.password,
        role: user.role,
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to create student");
    }
  });

export const getAllStudentsServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      const students = await getAllStudents(db);

      return { students };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch students");
    }
  });

export const createNoticeServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: NoticeInput) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      const { payload: admin } = await requireSession(db, "admin", data.token);
      const text = data.text.trim();

      if (!text) {
        throw new Error("Notice text is required");
      }

      const now = new Date();
      const result = await db.collection("notices").insertOne({
        text,
        adminId: admin.userId,
        adminName: admin.name,
        createdAt: now,
        updatedAt: now,
      });

      return { ok: true, noticeId: result.insertedId.toString() };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to create notice");
    }
  });

export const getAdminNoticesServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      const notices = await db
        .collection("notices")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return {
        notices: notices.map((notice) => ({
          id: notice._id.toString(),
          text: notice.text || "",
          adminId: notice.adminId || "",
          adminName: notice.adminName || notice.adminId || "Admin",
          createdAt: notice.createdAt?.toISOString?.() || new Date().toISOString(),
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch notices");
    }
  });

export const deleteNoticeServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; noticeId: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      const result = await db.collection("notices").deleteOne({
        _id: new ObjectId(data.noticeId),
      });

      if (result.deletedCount === 0) {
        throw new Error("Notice not found");
      }

      return { ok: true };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to delete notice");
    }
  });

export const toggleStudentActiveServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; userId: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      const updated = await updateStudentActive(db, data.userId, data.active);

      if (!updated) {
        throw new Error("Student not found");
      }

      return { ok: true };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to update student");
    }
  });

export const deleteStudentServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; userId: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      const deleted = await deleteStudent(db, data.userId);

      if (!deleted) {
        throw new Error("Student not found");
      }

      return { ok: true };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to delete student");
    }
  });

export const getAdminDashboardServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      await cleanupExpiredTestsAndImages(db);

      const [
        totalStudents,
        totalSubmissions,
        pendingEvaluations,
        publishedTests,
        topStudents,
        pending,
      ] = await Promise.all([
        db.collection("users").countDocuments({ role: "student" }),
        db.collection("submissions").countDocuments({}),
        db.collection("submissions").countDocuments({ status: "pending" }),
        db.collection("tests").countDocuments({ status: "published" }),
        db
          .collection("users")
          .find({ role: "student", active: { $ne: false } })
          .sort({ avgMarks: -1, totalTests: -1, userId: 1 })
          .limit(5)
          .project({ userId: 1, name: 1, avgMarks: 1, totalTests: 1 })
          .toArray(),
        db
          .collection("submissions")
          .aggregate([
            { $match: { status: "pending" } },
            {
              $lookup: {
                from: "users",
                localField: "studentId",
                foreignField: "userId",
                as: "student",
              },
            },
            {
              $lookup: {
                from: "tests",
                localField: "testId",
                foreignField: "_id",
                as: "test",
              },
            },
            { $sort: { submittedAt: 1 } },
            { $limit: 5 },
          ])
          .toArray(),
      ]);

      return {
        stats: {
          totalStudents,
          totalSubmissions,
          pendingEvaluations,
          publishedTests,
        },
        topStudents: topStudents.map((student, index) => ({
          rank: index + 1,
          userId: student.userId,
          username: student.name || student.userId,
          testsAttempted: Number(student.totalTests || 0),
          averageScore: Number(student.avgMarks || 0).toFixed(1),
        })),
        pending: pending.map((submission) => {
          const imageUrls =
            submission.imageUrls ||
            (submission.answers || []).flatMap((answer: any) => answer.imageUrls || []);

          return {
            id: submission._id.toString(),
            studentName: submission.student?.[0]?.name || submission.studentId,
            testTitle: submission.test?.[0]?.title || "Untitled test",
            files: imageUrls.length,
          };
        }),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch admin dashboard");
    }
  });

// Test Management Server Functions

export interface Question {
  id: string;
  text: string;
  imageUrl?: string; // Cloudinary secure URL
  imagePublicId?: string; // Cloudinary public ID for deletion
  marks: number;
}

export interface TestInput {
  token: string;
  title: string;
  subject: string;
  deadline: string;
  questions: Question[];
  status: "draft" | "published";
}

export interface Test {
  _id?: string;
  id?: string;
  adminId: string;
  adminName: string;
  title: string;
  subject: string;
  deadline: string;
  questions: Question[];
  status: "draft" | "published";
  totalQuestions: number;
  createdAt: Date;
  updatedAt: Date;
}

export const createTestServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: TestInput) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      const { payload: admin } = await requireSession(db, "admin", data.token);

      if (!data.title || !data.subject) {
        throw new Error("Title and subject are required");
      }

      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("At least one question is required");
      }

      // Validate each question has required fields
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        if (!q.id || (!q.text?.trim() && !q.imageUrl) || typeof q.marks !== "number") {
          throw new Error(`Question ${i + 1} is missing required fields`);
        }
      }

      const now = new Date();

      const test: Test = {
        adminId: admin.userId,
        adminName: admin.name,
        title: data.title,
        subject: data.subject,
        deadline: data.deadline || "",
        questions: data.questions.map((q) => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl, // Only store Cloudinary URL
          imagePublicId: q.imagePublicId, // Store for future deletion
          marks: q.marks,
        })),
        status: data.status,
        totalQuestions: data.questions.length,
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection("tests").insertOne(test as any);

      if (!result.insertedId) {
        throw new Error("Failed to insert test - no insert ID returned");
      }

      return {
        ok: true,
        testId: result.insertedId.toString(),
        message: `Test ${data.status === "published" ? "published" : "saved as draft"}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("createTestServerFn error:", msg);
      throw new Error(msg || "Failed to create test");
    }
  });

export const getTestsServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      const { payload: admin } = await requireSession(db, "admin", data.token);
      await cleanupExpiredTestsAndImages(db);
      const tests = await db
        .collection<Test>("tests")
        .find({ adminId: admin.userId })
        .sort({ createdAt: -1 })
        .toArray();

      return {
        tests: tests.map((t) => ({
          id: t._id?.toString(),
          title: t.title,
          subject: t.subject,
          deadline: t.deadline,
          adminId: t.adminId,
          adminName: t.adminName || admin.name,
          status: t.status,
          totalQuestions: t.totalQuestions,
          createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
          questions: t.questions,
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch tests");
    }
  });

export const deleteTestServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; testId: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      const { payload: admin } = await requireSession(db, "admin", data.token);
      await cleanupExpiredTestsAndImages(db);
      const { ObjectId } = await import("mongodb");
      
      const canDelete = await deleteTestFilesAndSubmissions(
        db,
        new ObjectId(data.testId),
        admin.userId,
      );

      if (!canDelete) {
        throw new Error("Test not found or unauthorized");
      }

      const result = await db.collection("tests").deleteOne({
        _id: new ObjectId(data.testId),
        adminId: admin.userId,
      });

      if (result.deletedCount === 0) {
        throw new Error("Test not found or unauthorized");
      }

      return { ok: true };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to delete test");
    }
  });

export const getPendingSubmissionsServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);
      await cleanupExpiredTestsAndImages(db);
      const submissions = await db
        .collection("submissions")
        .aggregate([
          { $match: { status: "pending" } },
          {
            $lookup: {
              from: "users",
              localField: "studentId",
              foreignField: "userId",
              as: "student",
            },
          },
          {
            $lookup: {
              from: "tests",
              localField: "testId",
              foreignField: "_id",
              as: "test",
            },
          },
          { $sort: { submittedAt: 1 } },
        ])
        .toArray();

      return {
        submissions: submissions.map((submission) => {
          const student = submission.student?.[0];
          const test = submission.test?.[0];
          const imageUrls =
            submission.imageUrls ||
            (submission.answers || []).flatMap((answer: any) => answer.imageUrls || []);
          const totalMarks = (test?.questions || []).reduce(
            (sum: number, question: any) => sum + Number(question.marks || 0),
            0,
          );

          return {
            id: submission._id.toString(),
            studentId: submission.studentId,
            studentName: student?.name || submission.studentId,
            testTitle: test?.title || "Untitled test",
            maxMarks: totalMarks,
            submittedAt: submission.submittedAt?.toISOString?.() || new Date().toISOString(),
            imageUrls,
            answers: (submission.answers || []).map((answer: any) => ({
              questionId: answer.questionId,
              questionTitle: answer.questionTitle || answer.questionId,
              text: answer.text || "",
              imageUrls: answer.imageUrls || [],
            })),
            files: imageUrls.length,
          };
        }),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch submissions");
    }
  });

export const evaluateSubmissionServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; submissionId: string; marks: number; feedback: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const marks = Number(data.marks);
      if (!Number.isFinite(marks) || marks < 0) {
        throw new Error("Enter valid marks");
      }

      const db = await connectToDatabase();
      const { payload: admin } = await requireSession(db, "admin", data.token);
      await cleanupExpiredTestsAndImages(db);
      const submission = await db.collection("submissions").findOne({
        _id: new ObjectId(data.submissionId),
        status: "pending",
      });

      if (!submission) {
        throw new Error("Pending submission not found");
      }

      const test = await db.collection("tests").findOne({ _id: submission.testId });
      if (!test) {
        throw new Error("Test not found for this submission");
      }

      const maxMarks = (test.questions || []).reduce(
        (sum: number, question: any) => sum + Number(question.marks || 0),
        0,
      );

      if (maxMarks <= 0) {
        throw new Error("This test does not have valid marks configured");
      }

      if (marks > maxMarks) {
        throw new Error(`Marks cannot be more than ${maxMarks}`);
      }

      await db.collection("submissions").updateOne(
        { _id: new ObjectId(data.submissionId) },
        {
          $set: {
            marks,
            feedback: data.feedback || "",
            evaluatedByAdminId: admin.userId,
            evaluatedByAdminName: admin.name,
            status: "evaluated",
            evaluatedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );

      await updateUserAvgMarks(db, submission.studentId, marks);

      return { ok: true };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to evaluate submission");
    }
  });

// Admin Recruitment Functions



export const getAdminRecruitmentRepliesServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      await initializeDefaultAdmin();
      const db = await connectToDatabase();
      await requireSession(db, "admin", data.token);

      const replies = await db
        .collection("noticereply")
        .find({ interested: true })
        .sort({ createdAt: -1 })
        .toArray();

      return {
        replies: replies.map((reply) => ({
          id: reply._id.toString(),
          studentId: reply.studentId,
          studentName: reply.studentName,
          suggestedPassword: reply.suggestedPassword,
          enthusiasmMsg: reply.enthusiasmMsg,
          status: reply.status || "pending",
          createdAt: reply.createdAt?.toISOString?.() || new Date().toISOString(),
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch admin recruitment replies");
    }
  });
