# Exhibition speech admission

The microphone's end-of-turn VAD used to retain `heardSpeech` and a 3.5-second
recent-energy window. An unrelated recognition result could use that old evidence
to appear in the customer transcript or cancel current playback.

The call now maintains a separate in-memory acoustic admission window.
An AudioWorklet measures RMS in 20ms windows independently of WebGL rendering.
Only bounded timestamp/energy batches cross to the main thread (at most one
in flight and 32 pending frames); raw audio is not sent by this detector.
Older browsers fall back to analyser polling and may conservatively reject
speech when rendering blocks sampling. Pending final candidates get at most
400ms to obtain queued evidence; this does not authorize unconfirmed speech. It learns
an ambient RMS baseline from a rolling low percentile, requires sustained energy
above that baseline, and applies a stronger threshold during AI output. Explicit
stop commands need 160ms evidence; ordinary interruptions need 280ms and at least
two words (explicit corrections are allowed). These are evidence windows, not
end-to-end latency promises. A missing/suspended analyser fails closed for voice;
typing and manual stop remain available. Microphone retry resets calibration.
Leaving playback preserves a customer's continuing sentence; entering playback
invalidates old listening evidence. Noise no longer extends the end-of-turn VAD.

Browser and local Diba results pass the same admission before transcript display,
turn dispatch or player cancellation. Rejected cumulative finals are masked so
a later near-field utterance cannot revive them. Rejected interim prefixes are
excluded from a later append; a rewritten rejected slot is conservatively ignored
until the next result. This can discard ambiguous words instead of guessing.
If rejected speech occurred in a recorder segment, raw batch transcription cannot
replace its admitted text or generate a request from that rejected segment.

Commands include وایسا، وایستا، صبر کن، یه لحظه، یک لحظه، بس کن، بسه، ساکت، ساکت شو.
A compound sentence such as «وایسا منظورم 6203 بود» remains a contextual request.
The existing acknowledgement follows an admitted pure stop and does not require
a new LLM request. Voice providers, visuals, routes and database are unchanged.

## Limits and validation

This is acoustic prominence filtering, not speaker identification, beamforming,
or speech separation. The microphone/STT engine can still receive background
audio; rejected text is withheld from the UI and AI. Equal-level overlapping
voices cannot reliably be separated with this logic. A bystander who is loud
and close can still pass. Early speech during ambient calibration, weak speech
in strong noise, and late finals can be rejected. Close microphone placement and
real exhibition testing remain necessary; do not claim zero false activations.

Unit tests use simulated RMS/text. The browser test uses a fake recognizer and
an actual WebAudio oscillator/AudioWorklet with the real call controller/player, verifying that
background words stay hidden, distant stop words do not cancel playback and an
admitted stop does cancel without another LLM request. Neither is an acoustic
accuracy benchmark. Validate actual Persian speech and part codes, television
speaker echo, quiet visitors, competing voices and device changes before an event.

Optional `?forzaVoiceDiagnostics=1` logs numerical admission evidence only.

Deploy using the existing `sudo sanatpish-deploy-main`; no migration or new service.

## Quiet microphone follow-up

Admission uses a relative ambient threshold with a 0.002 RMS listening minimum
and 0.004 during playback (2.3x / 3.5x ambient respectively). These are signal
thresholds, not sound-pressure or distance measurements. The ambient baseline
freezes as soon as a speech onset is a candidate, so speech does not raise its
own threshold while waiting for the persistence window. Once admission confirms
speech, end-of-turn tracking consumes that decision directly rather than applying
a second 0.008 RMS threshold and another onset delay. The analyser fallback uses
float PCM to preserve quiet signals below byte quantization.

Browser fixtures now exercise quiet 0.003 RMS listening and 0.009 oscillator gain
(about 0.0064 RMS) interruption, while retaining background rejection assertions.
These remain simulated recognition tests, not a real microphone accuracy claim.

AvalAI retries once, on the same configured model, only after an empty transport
failure (network error or EOF without completion). It does not retry partial
answers, timeouts, authentication, quota or model errors. The extra request can
consume provider usage; there is no cross-provider fallback. Response-service
errors now distinguish access/quota/timeout/truncation from STT failures.
