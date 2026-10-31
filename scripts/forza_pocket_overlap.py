#!/usr/bin/env python3
"""Experimental overlap of *unchanged* Pocket FlowLM and Mimi ONNX sessions.

Run only in isolated benchmark containers until quality/latency are validated.
Every latent is decoded with the exact same Mimi ONNX weights and KV state
updates as upstream OnnxTts._decode_all. No resampling/voice conversion/IO.
"""
from queue import Queue
from threading import Thread

import numpy as np


class MimiOverlap:
    _END = object()

    def __init__(self, engine):
        self.engine = engine
        self.queue = Queue(maxsize=3)
        self.parts = []
        self.error = None
        self.closed = False
        self.worker = Thread(target=self._decode, daemon=True, name="forza-mimi-overlap")
        self.worker.start()

    def add(self, latent):
        if self.closed:
            raise RuntimeError("mimi_overlap_closed")
        # The decoder only reads its own copy. FlowLM may reuse ONNX buffers.
        self.queue.put(np.array(latent, copy=True))

    def _decode(self):
        engine = self.engine
        state = [a.copy() for a in engine.dec_init]
        offset = 0
        # Keep draining after an exception to avoid deadlocking the producer.
        while True:
            latent = self.queue.get()
            if latent is self._END:
                break
            if self.error is not None:
                continue
            try:
                un = (latent.reshape(1, 1, engine.ldim)
                      * engine.emb_std + engine.emb_mean).astype(np.float32)
                feeds = {"latent": un}
                for i in range(len(state)):
                    feeds[engine.dec_in[1 + i]] = state[i]
                result = engine.s_dec.run(None, feeds)
                self.parts.append(result[0])
                for j, o in enumerate(engine.dec_out_small):
                    state[engine.small_slots[j]] = result[o]
                for j, o in enumerate(engine.dec_out_kv):
                    state[engine.cache_slots[j]][:, :, offset:offset + engine.steps_per_latent] = result[o]
                offset += engine.steps_per_latent
            except Exception as exc:
                self.error = exc

    def collect(self, expected_frames):
        if not self.closed:
            self.closed = True
            self.queue.put(self._END)
        self.worker.join(timeout=60)
        if self.worker.is_alive():
            raise RuntimeError("mimi_overlap_timeout")
        if self.error is not None:
            raise self.error
        if expected_frames == 0:
            return None
        if not 0 < expected_frames <= len(self.parts):
            raise RuntimeError("mimi_overlap_frame_count_mismatch")
        # Upstream may generate an EOS check frame then NOT append it to
        # latents. It is safe to discard its trailing decoder output:
        # all prior Mimi outputs are causal, and returned PCM stays identical.
        return np.concatenate(self.parts[:expected_frames], axis=2)[0, 0]
