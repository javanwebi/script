# U²-NetP browser segmentation model

- Model: U²-NetP (`u2netp.onnx`), 320×320 input, browser-side WASM inference.
- Original project: [U-2-Net](https://github.com/xuebinqin/U-2-Net), by Xuebin Qin et al.
- Primary mirror: `https://huggingface.co/edgetools/u2netp/resolve/main/u2netp.onnx`.
- Secondary mirror: `https://huggingface.co/nfa04/u2netp-onnx/resolve/main/u2netp.onnx`.
- Upstream release: `https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx`.
- SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`.
- Expected size: 4,574,861 bytes.
- Upstream project license: Apache-2.0; exact upstream text is shipped at `/licenses/U2-Net-APACHE-2.0.txt`.
- ONNX conversion project: `danielgatis/rembg` (MIT); its license is shipped at `/licenses/rembg-MIT.txt`.
- The build downloads the pinned ONNX artifact and verifies its byte size and SHA-256 before placing it in `public/models/`.

The model is used only for optional client-side foreground segmentation. If it cannot be loaded, the visual-identification interface continues with the existing server/manual region flow and never substitutes a sample image for a customer's photo.
