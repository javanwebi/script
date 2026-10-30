# FORZA Pocket streaming: safe Ubuntu benchmark

## Baseline and new approach
The public Express proxy returned a 200746-byte WAV (about 4.18 seconds of
24000 Hz mono PCM speech) after 27.004 seconds. Python logs show about
26.97 seconds of inference. Prior 1-vCPU / 1.75-vCPU A/B averages were
16.672 s and 13.239 s respectively for full WAV generation; neither was
real-time. The new Python and Express paths deliver the first independently
generated ONNX WAV chunk without waiting for the entire reply.

The browser uses a bounded length-prefixed WAV frame decoder, the existing
Web Audio sample-clock queue, and the legacy full-WAV route as fallback.
The selected Pocket Farsi model and voice reference are unchanged.

## Isolated benchmark on the existing VPS
Run during LOW traffic; the test worker uses an additional 1.75 vCPU and
1.5 GiB of RAM and can briefly contend with production workloads.
It does not replace existing containers, change the checked-out app source,
or modify Nginx or Supabase. It cleans up the temporary worker on exit.

~~~bash
cd /opt/sanatpish
git status --short
docker ps --format 'table {{.Names}}\t{{.Status}}'
git fetch origin feat/forza-progressive-pocket-stream-20261031
git show FETCH_HEAD:ops/forza-voice-stream-benchmark-vps.sh \
  > /tmp/forza-voice-stream-benchmark-vps.sh
sudo bash -n /tmp/forza-voice-stream-benchmark-vps.sh
sudo bash /tmp/forza-voice-stream-benchmark-vps.sh
~~~

The results list first_wav_ms (the first complete playable WAV, not just
HTTP headers), total_ms, frames, audio_s, rtf, and peak RAM. The script
prints FORZA_STREAM_BENCH_PASS when the candidate is functional and the
live app stayed up. This is NOT production sign-off. Check that WAV chunks
contain all words, the same voice and acceptable loudness and that CPU
contention does not impair the public website. A smooth real-time pipeline
needs RTF below 1; currently the recorded full-WAV baseline is above 1.

## Rollout gate
This PR is a draft. Do not merge or replace the live voice container
without a successful real VPS benchmark, browser QA and a verified
rollback plan retaining the old image/container. The older
ops/forza-voice-promote-vps.sh is for a different candidate image and must
NOT be run for this streaming change. Express/frontend and private Python
workers can be rolled out in stages because streaming HTTP errors fall back
to the established full-WAV endpoint.

Barge-in, realtime Persian STT and any Gemini 403 are independent issues.
Avoid exposing the private port, access token or model downloads publicly.
