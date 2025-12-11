import { NextResponse } from "next/server";
import { z } from "zod";

const envSchema = z.object({
  STRAVA_CLIENT_ID: z.string().min(1),
  STRAVA_REDIRECT_URI: z.string().url(),
});

const scopes = process.env.STRAVA_SCOPES ?? "read,activity:read_all";

export async function GET() {
  const parseEnv = envSchema.safeParse({
    STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
    STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI,
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

  const { STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI } = parseEnv.data;
  const state = crypto.randomUUID();

  const redirectUrl = new URL("https://www.strava.com/oauth/authorize");
  redirectUrl.searchParams.set("client_id", STRAVA_CLIENT_ID);
  redirectUrl.searchParams.set("response_type", "code");
  redirectUrl.searchParams.set("redirect_uri", STRAVA_REDIRECT_URI);
  redirectUrl.searchParams.set("scope", scopes);
  redirectUrl.searchParams.set("state", state);
  redirectUrl.searchParams.set("approval_prompt", "auto");

  const response = NextResponse.redirect(redirectUrl.toString());
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
