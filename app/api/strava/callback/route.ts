import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const envSchema = z.object({
  STRAVA_CLIENT_ID: z.string().min(1),
  STRAVA_CLIENT_SECRET: z.string().min(1),
});

const querySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  athlete: z.unknown(),
});

export async function GET(req: NextRequest) {
  const parseEnv = envSchema.safeParse({
    STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET,
  });

  if (!parseEnv.success) {
    return NextResponse.json(
      {
        error: "config_missing",
        message: "Strava OAuth is not configured yet.",
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const requestError = searchParams.get("error");

  if (requestError) {
    return NextResponse.json({ error: requestError }, { status: 400 });
  }

  const parsedQuery = querySchema.safeParse({
    code: searchParams.get("code"),
    state: searchParams.get("state"),
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "invalid_query", details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = parseEnv.data;
  const { code, state } = parsedQuery.data;

  const storedState = req.cookies.get("strava_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return NextResponse.json(
      { error: "token_exchange_failed", status: tokenResponse.status },
      { status: 502 },
    );
  }

  const tokenPayload = tokenResponseSchema.safeParse(await tokenResponse.json());
  if (!tokenPayload.success) {
    return NextResponse.json(
      { error: "invalid_token_response", details: tokenPayload.error.flatten() },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    accessToken: tokenPayload.data.access_token,
    refreshToken: tokenPayload.data.refresh_token,
    expiresAt: tokenPayload.data.expires_at,
    athlete: tokenPayload.data.athlete,
  });

  response.cookies.set("strava_oauth_state", "", { maxAge: 0, path: "/" });

  return response;
}
