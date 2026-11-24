import { MongoClient } from "mongodb";

let client;
let database;

function getClient() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4_000,
      maxPoolSize: 5,
    });
  }
  return client;
}

export async function connectEvents() {
  const connection = getClient();
  await connection.connect();
  database = connection.db(process.env.MONGODB_DATABASE || "seatspace");
  const validator = { $jsonSchema: {
    bsonType: "object",
    required: ["action", "actorId", "entityType", "occurredAt"],
    properties: {
      action: { bsonType: "string", minLength: 1, maxLength: 80 },
      actorId: { bsonType: ["string", "null"] },
      entityType: { bsonType: "string", minLength: 1, maxLength: 40 },
      entityId: { bsonType: ["string", "null"] },
      occurredAt: { bsonType: "date" },
      metadata: { bsonType: "object" },
    },
  } };
  const exists = await database.listCollections({ name: "activity_events" }, { nameOnly: true }).hasNext();
  if (!exists) {
    await database.createCollection("activity_events", { validator, validationLevel: "strict" });
  }
  const collection = database.collection("activity_events");
  await collection.createIndex({ actorId: 1, occurredAt: -1 });
  await collection.createIndex({ entityType: 1, entityId: 1, occurredAt: -1 });
  await collection.createIndex({ occurredAt: -1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 3 });
  return database;
}

export async function writeActivity({ action, actorId = null, entityType, entityId = null, metadata = {} }) {
  if (!database) throw new Error("MongoDB activity store is not connected");
  await database.collection("activity_events").insertOne({
    action,
    actorId: actorId == null ? null : String(actorId),
    entityType,
    entityId: entityId == null ? null : String(entityId),
    occurredAt: new Date(),
    metadata,
  });
}

export async function recentActivity(limit = 100) {
  if (!database) throw new Error("MongoDB activity store is not connected");
  return database.collection("activity_events")
    .find({}, { projection: { _id: 0 } })
    .sort({ occurredAt: -1 })
    .limit(limit)
    .toArray();
}

export async function mongoHealth() {
  if (!database) throw new Error("MongoDB activity store is not connected");
  await database.command({ ping: 1 });
}

export async function closeMongo() {
  await client?.close();
  client = undefined;
  database = undefined;
}
