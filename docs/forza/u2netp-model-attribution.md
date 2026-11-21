# U²-NetP browser segmentation model

- Model: U²-NetP (`u2netp.onnx`), 320×320 input, browser-side WASM inference.
- Original project: [U-2-Net](https://github.com/xuebinqin/U-2-Net), by Xuebin Qin et al.
- Distribution URL: `https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx`.
- SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`.
- Expected size: 4,574,861 bytes.
- License: Apache-2.0 for the U²-Net weights. The build script downloads the upstream artifact and verifies its checksum before placing it in `public/models/`.

The model is used only for optional client-side foreground segmentation. If it cannot be loaded, the visual-identification interface continues with the existing server/manual region flow and never substitutes a sample image for a customer's photo.
