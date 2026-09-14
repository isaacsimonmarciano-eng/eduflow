export type ImportedSource = {
  id: string;
  name: string;
  kind: "text" | "document" | "photo" | "audio";
  mime: string;
  text: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    if (line.trim()) pages.push(line.trim());
  }
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const an = Number(a.match(/slide(\d+)/i)?.[1] ?? 0);
      const bn = Number(b.match(/slide(\d+)/i)?.[1] ?? 0);
      return an - bn;
    });
  const chunks: string[] = [];
  for (const slide of slides) {
    const xml = await zip.files[slide].async("text");
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => match[1])
      .join(" ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    if (text.trim()) chunks.push(text.trim());
  }
  return chunks.join("\n\n");
}

async function extractImage(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra+eng");
  try {
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

async function decodeAudio(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Le navigateur ne peut pas lire cet audio.");
  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const targetRate = 16_000;
    const length = Math.ceil(decoded.duration * targetRate);
    const offline = new OfflineAudioContext(1, length, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    await context.close();
  }
}

async function transcribeAudio(file: File): Promise<string> {
  const transformers = await import("@huggingface/transformers");
  transformers.env.allowLocalModels = false;
  const transcriber = await transformers.pipeline(
    "automatic-speech-recognition",
    "onnx-community/whisper-tiny",
    { dtype: "q8" },
  );
  const audio = await decodeAudio(file);
  const run = transcriber as unknown as (
    input: Float32Array,
    options: { language: string; task: string; chunk_length_s: number; stride_length_s: number },
  ) => Promise<{ text?: string }>;
  const result = await run(audio, {
    language: "fr",
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  return result.text?.trim() ?? "";
}

export async function extractImportedFile(file: File): Promise<ImportedSource> {
  const lower = file.name.toLowerCase();
  let kind: ImportedSource["kind"] = "document";
  let text = "";

  if (file.type.startsWith("image/")) {
    kind = "photo";
    text = await extractImage(file);
  } else if (file.type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg)$/i.test(lower)) {
    kind = "audio";
    text = await transcribeAudio(file);
  } else if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    text = await extractPdf(file);
  } else if (lower.endsWith(".docx")) {
    text = await extractDocx(file);
  } else if (lower.endsWith(".pptx")) {
    text = await extractPptx(file);
  } else if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(lower)) {
    text = await file.text();
  } else {
    throw new Error(`Format non pris en charge : ${file.name}`);
  }

  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) throw new Error(`Aucun texte exploitable trouvé dans ${file.name}.`);
  return { id: uid(), name: file.name, kind, mime: file.type || "application/octet-stream", text: clean };
}

export function textSource(text: string): ImportedSource {
  return {
    id: uid(),
    name: "Texte saisi",
    kind: "text",
    mime: "text/plain",
    text: text.trim(),
  };
}
