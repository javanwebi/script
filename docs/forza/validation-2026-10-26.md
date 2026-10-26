# FORZA corrective pass — 2026-10-26

This is partial implementation, not end-to-end acceptance or production verification.

Changes: image-only search now requests retrieval rather than observation-only measurements; unverified sibling SKUs are no longer automatically labelled visually similar; exact-photo evidence rejects absent, coerced, negative and nonfinite distances. Resumed syllables refresh the silence timer, timer reads no longer inject synthetic silence, and transcript timeout checks microphone/turn state. The subtitle panel is bounded and scrollable.

Validation: TypeScript and production build passed. 38 FORZA/recognition tests, 25 database tests and 28 portal tests passed (no skips). These are local automated tests; database tests use isolated PGlite fixtures.

Outstanding: real browser microphone/playback, hardware noise scenarios (10 trials each), WER and P50/P95 latency, streaming provider capabilities, conversation continuity after reconnect, modern image upload design, verified family presentation, recognition from reverse-angle images, production deployment and real Supabase integration. No real audio benchmark or provider generation was completed.

The configured source Worker hostname atlasai.javanwebio.workers.dev was blocked by the network proxy (CONNECT 403). No Worker token, Gemini key or Supabase/database binding was injected. Git read access works. GitHub/Supabase/Railway connector tools and conversation-read tools were unavailable in this session. Both Worker domains and the Railway site domain were saved as network draft additions; that does not activate network access. Secure bindings and access to an isolated populated adopted-schema database are prerequisites for live API validation. No production migration or deployment was performed.

## Follow-up browser verification

Chromium 154 loaded the live /ai-forza page with no pageerror events. HTTPS requests used Playwright route.fetch with the system CA bundle because Chromium's native certificate trust failed; TLS verification remained enabled. Fake media devices were used, so this is not real microphone/noise acceptance.

A live UI test typed and submitted a question while greeting preparation was pending. The input disappeared but no answer appeared: submitUserText refused the turn while the form cleared the input unconditionally. Fixed by returning an acceptance boolean, retaining the input when busy, and disabling submission during greeting, thinking and speaking. The rebuilt local preview passed a Chromium regression: submission disabled before greeting completion; pressing Enter preserves the exact typed question. TypeScript and build passed.

The live preview showed 7–10 FPS in this software-rendered browser, not a hardware performance measurement. Greeting preparation still appeared at approximately 33 seconds in that run; end-to-end playback remains unverified. Prior real HTTP checks returned a Persian FORZA response in 1.18 seconds and a WAV TTS response in 3.59 seconds. These single observations are not P50/P95 benchmarks. No deployment was performed.

## Short greeting, image entry and bounded speech

Greeting is now exactly «هوش مصنوعی فورزا، مشاور صنعت پیش.» in shared display/TTS/cache code. FORZA now opens the same image upload/search component as the site through an image scan button; microphone listening is muted when it opens. Text history sent to FORZA now retains 24 entries on client and server (bounded recent context, not permanent memory). Responses are split into <=240-character speech requests, spoken sequentially, avoiding the server's 1800-character rejection and waiting for synthesis of an entire long reply. This is chunked synthesis, not provider streaming. TTS fetch has a 25-second timeout; closing the call prevents later chunks starting.

Validation: 40 FORZA/recognition tests, 25 database tests and 28 portal tests passed. TypeScript and build passed. Chromium opened the shared upload wizard without page errors. A mock-provider Chromium test generated and played silent WAV chunks for a long Persian reply, verified the short greeting and every text chunk in order. This validates browser control flow, not provider quality. Browser scripts are under scripts/tests/forza-{audio-chunks,image-entry}.cjs; run with Playwright available via NODE_PATH and a built preview on port 4173, system Chromium at /usr/bin/chromium.

A real synthesized WAV sent through the live FORZA API transcribed «سلام. من مشاور صنعت پیش هستم.» and produced a model reply; server timings STT 1209 ms, model 728 ms, observed total 2.30 seconds. No factory-noise WER, real-microphone acceptance, reverse-angle image recognition or permanent conversation memory is claimed.
