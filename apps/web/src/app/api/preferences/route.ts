import {
  compilePreferenceText,
  compilePreferenceWithModel,
} from "@blinkpay/policy";
import {
  DEFAULT_OPENAI_POLICY_MODEL,
  createOpenAiPreferenceProvider,
} from "@blinkpay/policy/openai";
import { NextResponse } from "next/server";

type PreferenceRequestBody = {
  preferenceText?: unknown;
};

export async function POST(request: Request) {
  let body: PreferenceRequestBody;
  try {
    const value: unknown = await request.json();
    if (!isRecord(value)) throw new Error("Request body must be a JSON object");
    body = value;
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }

  if (typeof body.preferenceText !== "string") {
    return NextResponse.json({ error: "preferenceText must be a string" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const result = apiKey
    ? await compilePreferenceWithModel(
      body.preferenceText,
      createOpenAiPreferenceProvider({
        apiKey,
        model: process.env.OPENAI_POLICY_MODEL?.trim() || DEFAULT_OPENAI_POLICY_MODEL,
      }),
    )
    : compilePreferenceText(body.preferenceText);
  if (result.status === "clarification") {
    return NextResponse.json(result, { status: 422 });
  }
  return NextResponse.json({
    status: result.status,
    source: result.source,
    policy: result.policy,
    explanations: result.explanations,
    ...(result.warning ? { warning: result.warning } : {}),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid request body";
}
