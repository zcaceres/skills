import sharp from "sharp";

// Real decodable images, not signature-only stubs: conversion tests exercise codecs.
const pixels = Buffer.from([
  255, 0, 0, 0, 255, 0, 0, 0, 255,
  240, 180, 60, 120, 50, 200, 40, 80, 160,
]);
const input = () => sharp(pixels, { raw: { width: 3, height: 2, channels: 3 } });
export const PNG_BYTES = await input().png().toBuffer();
export const PNG = PNG_BYTES.toString("base64");
export const JPEG = await input().jpeg({ quality: 95 }).toBuffer();
export const WEBP = await input().webp({ lossless: true }).toBuffer();
export const completed = {
  status: "completed",
  steps: [
    { type: "thought", content: [{ type: "image", data: "not-output" }] },
    { type: "model_output", content: [{ type: "text", text: "Here is your image." }] },
    { type: "model_output", content: [{ type: "image", mime_type: "image/png", data: PNG }] },
  ],
};
export const jpegResponse = {
  status: "completed",
  steps: [{
    type: "model_output",
    content: [{ type: "image", mime_type: "image/jpeg", data: JPEG.toString("base64") }],
  }],
};
