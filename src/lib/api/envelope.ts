/**
 * envelope.ts — the single JSON envelope every /api/* route answers with
 * (PLAN-placement.md §5). Shapes are the pinned ApiOk/ApiFail types;
 * status is derived from the error code: TMDB_NOT_CONFIGURED→503,
 * TMDB_UPSTREAM_ERROR→502 (a TMDB 429 passes through as 429 via the
 * optional status argument), BAD_REQUEST→400. Empty results are
 * ok([]) — an empty UI state, never an error.
 */

import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiFail, ApiOk } from "../tmdb/types";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  TMDB_NOT_CONFIGURED: 503,
  TMDB_UPSTREAM_ERROR: 502,
  BAD_REQUEST: 400,
};

/** 200 {"ok":true,"data":data} */
export function ok<T>(data: T): Response {
  return NextResponse.json({ ok: true, data } satisfies ApiOk<T>);
}

/**
 * {"ok":false,"error":{"code","message"}} with the status mapped from the
 * code; pass `status` only to override it (PLAN §5: upstream 429 → 429).
 */
export function fail(
  code: ApiErrorCode,
  message: string,
  status: number = STATUS_BY_CODE[code],
): Response {
  return NextResponse.json(
    { ok: false, error: { code, message } } satisfies ApiFail,
    { status },
  );
}
