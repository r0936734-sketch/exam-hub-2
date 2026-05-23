import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "exam-hub";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

const mongoUri = MONGODB_URI;

function describeMongoConnectionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  return new Error(
    [
      "Could not connect to MongoDB.",
      "Check that your Atlas cluster is running, your current IP is allowed in Network Access, and your connection string is correct.",
      "If you are using MongoDB Atlas, try copying the latest Node.js driver connection string and include the database name.",
      `Original error: ${message}`,
    ].join(" "),
  );
}

export async function connectToDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  if (!cachedClient) {
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      tls: mongoUri.startsWith("mongodb+srv://") ? true : undefined,
    });

    try {
      await client.connect();
      cachedClient = client;
    } catch (error) {
      cachedClient = null;
      cachedDb = null;
      await client.close().catch(() => {});
      throw describeMongoConnectionError(error);
    }
  }

  cachedDb = cachedClient.db(DB_NAME);

  // Create indexes
  try {
    await cachedDb.collection("users").createIndex({ userId: 1 }, { unique: true });
    await cachedDb.collection("submissions").createIndex({ studentId: 1 });
    await cachedDb.collection("submissions").createIndex({ testId: 1 });
    await cachedDb.collection("tests").createIndex({ status: 1, createdAt: -1 });
    await cachedDb.collection("notices").createIndex({ createdAt: -1 });
  } catch (error) {
    cachedDb = null;
    throw describeMongoConnectionError(error);
  }

  return cachedDb;
}

export async function closeDatabase(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
