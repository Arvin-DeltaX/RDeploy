import crypto from "crypto";
import https from "https";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { encrypt, decrypt } from "../utils/encryption";

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
}

function httpsPost(
  url: string,
  data: Record<string, string>,
  headers: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
      res.on("end", () => resolve(raw));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(
  url: string,
  headers: Record<string, string>
): Promise<{ body: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers,
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
      res.on("end", () => resolve({ body: raw, statusCode: res.statusCode ?? 0 }));
    });

    req.on("error", reject);
    req.end();
  });
}

export function generateOAuthStateToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign(
    { purpose: "github-oauth-state", userId, nonce: crypto.randomUUID() },
    secret,
    { expiresIn: "10m" }
  );
}

export function verifyOAuthStateToken(state: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  const payload = jwt.verify(state, secret) as Record<string, unknown>;

  if (payload.purpose !== "github-oauth-state" || typeof payload.userId !== "string" || !payload.userId) {
    throw new Error("Invalid state token");
  }

  return payload.userId;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error("GitHub OAuth environment variables are not configured");
  }

  const raw = await httpsPost(
    "https://github.com/login/oauth/access_token",
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    },
    { Accept: "application/json" }
  );

  const response = JSON.parse(raw) as GitHubTokenResponse;

  if (response.error || !response.access_token) {
    throw new Error(response.error_description ?? "Failed to exchange GitHub code for token");
  }

  return response.access_token;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const { body, statusCode } = await httpsGet("https://api.github.com/user", {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "RDeploy",
    Accept: "application/json",
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`GitHub API returned ${statusCode} when fetching user`);
  }

  const user = JSON.parse(body) as GitHubUser;
  if (typeof user.id !== "number" || !user.login) {
    throw new Error("Invalid GitHub user response");
  }
  return user;
}

export async function linkGitHubAccount(
  userId: string,
  accessToken: string
): Promise<void> {
  const githubUser = await fetchGitHubUser(accessToken);
  const githubId = String(githubUser.id);

  // Check if this GitHub account is already linked to a different user
  const existing = await prisma.user.findUnique({ where: { githubId } });
  if (existing && existing.id !== userId) {
    throw new Error("github_already_linked");
  }

  const encryptedToken = encrypt(accessToken);

  await prisma.user.update({
    where: { id: userId },
    data: {
      githubId,
      githubUsername: githubUser.login,
      githubAccessToken: encryptedToken,
    },
  });
}

export async function disconnectGitHub(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      githubId: null,
      githubUsername: null,
      githubAccessToken: null,
    },
  });
}

export async function getDecryptedGitHubToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true },
  });

  if (!user?.githubAccessToken) return null;

  return decrypt(user.githubAccessToken);
}
