# Browser STT recovery, 2026-11-08

Keep existing fa-IR Web Speech; no server model, API key, provider or database
configuration change is required for browser speech recognition.

## Fixes

- Normal `onend` restarts the current recognizer during listening, thinking and
  manual/Nima playback. Previously the status gate prevented some restarts
  during playback, so interruption silently stopped working.
- Use the tracked restart timer; check current recognizer identity, call closure,
  greeting readiness and current mute state before every restart. A stale
  recognizer must not deactivate or restart its replacement.
- Reset both browser failure flags on actual recognition start/results and on
  explicit microphone reinitialization. An already-starting Chrome recognizer
  (`InvalidStateError`) is not a permanent network failure.
- Empty/noise-only recorder segments do not create failed AI turns when the
  optional server STT is known absent. Preserve already displayed valid text,
  keep RAM recording alive and let browser recognition continue. Real browser
  permission/network failures still show actionable messages and bounded retries.
- Add an explicit reconnect-microphone action, without page reload or loss of
  conversation history. Missing browser recognition remains an explicit error.

## Validation and limits

37 targeted tests pass, including execution of the real onend callback against
browser doubles: restart/coalescing, stale replacement, mute/hangup, permanent
failure, and no spurious AI request for an empty segment. TypeScript and build
pass. Database/portal checks run separately. Physical microphone, Chrome's
external recognition service and a noisy speakerphone are not mocked away as
proof of success. A genuine browser/network outage cannot be guaranteed away.

After merge, deploy with `cd /opt/sanatpish` then
`sudo sanatpish-deploy-main`. Exit the existing call and hard-refresh. Say a
short phrase, allow a silent recognition session to end, speak during Nima,
then test a brief network disruption and explicit reconnect. Verify recognized
text, actual recognizer restart, no fake empty user turn, and no microphone
reactivation after exit. No new local STT installation is needed for these fixes.
