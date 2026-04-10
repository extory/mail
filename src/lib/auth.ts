import { SignJWT, jwtVerify } from "jose";
import { hashSync, compareSync } from "bcryptjs";
import { cookies } from "next/headers";
import { getUserByEmail, createUser, getInvitationByCode, markInvitationUsed } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "mail-service-secret-key-change-in-production"
);
const COOKIE_NAME = "mail_session";
const SUPER_USER = "nick@extory.co";

export async function signUp(email: string, password: string, inviteCode: string) {
  // Validate invite code
  const invitation = getInvitationByCode(inviteCode);
  if (!invitation) {
    return { error: "Invalid or expired invitation code" };
  }
  if (invitation.email !== email) {
    return { error: "This invitation was sent to a different email" };
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return { error: "Email already registered" };
  }

  const hash = hashSync(password, 10);
  const user = createUser(email, hash, "user");
  markInvitationUsed(invitation.id);

  const token = await createToken(user.id, user.email, user.role);
  await setSessionCookie(token);
  return { user: { id: user.id, email: user.email, role: user.role } };
}

export async function signIn(email: string, password: string) {
  const user = getUserByEmail(email);
  if (!user) {
    return { error: "Invalid email or password" };
  }
  if (!compareSync(password, user.password_hash)) {
    return { error: "Invalid email or password" };
  }
  const token = await createToken(user.id, user.email, user.role);
  await setSessionCookie(token);
  return { user: { id: user.id, email: user.email, role: user.role } };
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: number; email: string; role: string };
  } catch {
    return null;
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

async function createToken(id: number, email: string, role: string) {
  return new SignJWT({ id, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function ensureSuperUser() {
  const existing = getUserByEmail(SUPER_USER);
  if (!existing) {
    const hash = hashSync("admin1234", 10);
    createUser(SUPER_USER, hash, "admin");
  }
}
