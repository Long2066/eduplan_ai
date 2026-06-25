const fs = require("fs");
const path = require("path");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function loadEnv() {
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ||= value.replace(/\\n/g, "\n");
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run grant-admin -- user@example.com");
    process.exit(1);
  }

  loadEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Missing Firebase Admin env.");

  const app = getApps()[0] || initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

  const user = await getAuth().getUserByEmail(email);
  await getFirestore(app, databaseId).collection("users").doc(user.uid).set(
    {
      email: user.email || email,
      displayName: user.displayName || "",
      emailVerified: Boolean(user.emailVerified),
      role: "admin",
      updatedAt: new Date(),
    },
    { merge: true },
  );
  console.log(`Granted admin role to ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
