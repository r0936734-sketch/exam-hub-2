import type { Db, ObjectId } from "mongodb";

export interface AdminUser {
  _id?: ObjectId;
  userId: string;
  name: string;
  password: string;
  role: "admin";
  active?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function findAdminByUserId(db: Db, userId: string): Promise<AdminUser | null> {
  return db.collection<AdminUser>("admins").findOne({
    userId: userId.trim().toUpperCase(),
  });
}

export async function upsertAdmin(
  db: Db,
  admin: {
    userId: string;
    name: string;
    password: string;
    active?: boolean;
    createdAt?: Date;
  },
) {
  const now = new Date();

  await db.collection<AdminUser>("admins").updateOne(
    { userId: admin.userId.trim().toUpperCase() },
    {
      $set: {
        name: admin.name.trim(),
        password: admin.password.trim(),
        role: "admin",
        active: admin.active !== false,
        updatedAt: now,
      },
      $setOnInsert: {
        userId: admin.userId.trim().toUpperCase(),
        createdAt: admin.createdAt || now,
      },
    },
    { upsert: true },
  );
}

export async function migrateLegacyAdmins(db: Db) {
  const legacyAdmins = await db
    .collection("users")
    .find({
      $or: [{ role: "admin" }, { userId: { $regex: /^ADM\d+$/ } }],
    })
    .toArray();

  for (const admin of legacyAdmins) {
    await upsertAdmin(db, {
      userId: admin.userId,
      name: admin.name || "Platform Admin",
      password: admin.password || "",
      active: admin.active !== false,
      createdAt: admin.createdAt instanceof Date ? admin.createdAt : new Date(),
    });
  }

  if (legacyAdmins.length > 0) {
    await db.collection("users").deleteMany({
      _id: { $in: legacyAdmins.map((admin) => admin._id) },
    });
  }
}
