# Staged Generation Rollout

## Safety model

The staged pipeline requires both flags:

    GENERATION_PIPELINE_MODE=staged
    NEXT_PUBLIC_GENERATION_PIPELINE_MODE=staged

It also requires a server-side canary match:

    GENERATION_STAGED_ALLOWLIST=teacher@example.com,user_uid_here
    GENERATION_STAGED_KILL_SWITCH=false

If either mode flag remains legacy, the kill switch is true, or the current
account is not in the allowlist, that account continues through the legacy
/api/lesson/generate flow. An empty allowlist fails closed. Use "*" only after
the canary period when staged should be available to every account.

## Recommended rollout

1. Deploy to a non-production environment with both flags set to staged and
   only the test account in GENERATION_STAGED_ALLOWLIST.
2. Test one lesson without images, one lesson with 2-3 images, and one
   multi-period lesson.
3. Reload the page during generation and confirm that the saved job resumes.
4. Cancel one active job and confirm that its reservation is released.
5. Confirm that completed jobs appear in lesson history and export to Word.
6. Review Firestore generationJobs, generationOperations, lessons, and
   entitlementLedger before enabling production.
7. Set GENERATION_STAGED_KILL_SWITCH=true for an immediate server-side rollback.

## Smoke command

Dry-run validation does not call Firebase, OpenAI, or the deployed app:

    npm run smoke:staged -- --dry-run

A live smoke test can consume one generation allowance. It is deliberately
blocked unless all variables below are supplied:

    STAGED_SMOKE_TEST_CONFIRM=1
    STAGED_SMOKE_BASE_URL=https://staging.example.com
    STAGED_SMOKE_COOKIE=eduplan_session=your_session_cookie
    STAGED_SMOKE_INPUT_FILE=./fixtures/staged-smoke-input.json

Then run:

    npm run smoke:staged

Never commit the session cookie or a smoke input containing private data.

## Lifecycle cleanup

Set a long random CRON_SECRET in the deployment environment. Vercel invokes
the protected cleanup route once per day through vercel.json. The cleanup:

1. Finds generationJobs whose expiresAt is overdue.
2. Marks unfinished jobs failed and releases their reserved usage.
3. Deletes private input images from Firebase Storage.
4. Retries safely when quota was already released or a file was already gone.

Firestore TTL is still recommended as a second cleanup layer:

- Collection group generationJobs, field expiresAt.
- Collection group artifacts, field expiresAt.

Do not enable TTL on generationOperations.expiresAt. Reserved operations must
be released through the accounting transaction before they are deleted.
