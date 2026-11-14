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
