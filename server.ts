import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
// @ts-ignore
import ffmpegPath from "ffmpeg-static";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Initialize Gemini client on server with user-agent 'aistudio-build'
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", aiEnabled: !!ai });
});

app.post("/api/transcode", async (req, res) => {
  try {
    const { wavBase64, format } = req.body;

    if (!wavBase64 || !format) {
      return res.status(400).json({ error: "wavBase64 and format are required" });
    }

    const allowedFormats = ["ogg", "flac", "aac", "m4a"];
    const targetFormat = format.toLowerCase();
    if (!allowedFormats.includes(targetFormat)) {
      return res.status(400).json({ error: `Unsupported target format: ${format}` });
    }

    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tempInput = path.join(os.tmpdir(), `input_${id}.wav`);
    const outExt = targetFormat === "aac" ? "m4a" : targetFormat;
    const tempOutput = path.join(os.tmpdir(), `output_${id}.${outExt}`);

    // Write input WAV file
    await fs.promises.writeFile(tempInput, Buffer.from(wavBase64, "base64"));

    // Prepare ffmpeg arguments
    let args = ["-y", "-i", tempInput];

    if (targetFormat === "ogg") {
      args.push("-c:a", "libvorbis", "-q:a", "5"); 
    } else if (targetFormat === "flac") {
      args.push("-c:a", "flac");
    } else if (targetFormat === "aac" || targetFormat === "m4a") {
      args.push("-c:a", "aac", "-b:a", "192k");
    }

    args.push(tempOutput);

    execFile(ffmpegPath!, args, async (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg transcoding error:", stderr);
        try { await fs.promises.unlink(tempInput); } catch {}
        try { await fs.promises.unlink(tempOutput); } catch {}
        return res.status(500).json({ error: "FFmpeg transcoding failed", details: stderr });
      }

      try {
        const outputBuffer = await fs.promises.readFile(tempOutput);
        res.json({
          base64: outputBuffer.toString("base64"),
          format: targetFormat
        });
      } catch (readError: any) {
        console.error("Failed to read output file:", readError);
        res.status(500).json({ error: "Failed to read transcoded file" });
      } finally {
        try { await fs.promises.unlink(tempInput); } catch {}
        try { await fs.promises.unlink(tempOutput); } catch {}
      }
    });
  } catch (err: any) {
    console.error("Transcode route error:", err);
    res.status(500).json({ error: err.message || "Internal server error during transcoding" });
  }
});

app.post("/api/align", async (req, res) => {
  try {
    const { text, segments } = req.body;

    if (!text || !segments) {
      return res.status(400).json({ error: "Text and segments are required" });
    }

    if (!ai) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server. Please configure it in your Secrets." });
    }

    const prompt = `You are an Audio-Text Alignment AI. Your task is to align a list of text lines (lyrics, script, or narrative) with a list of detected active audio intervals (vocal activity / energy peaks) that were analyzed from an audio file.

Pasted Lyrics/Script:
${text}

Detected Audio Active Intervals (with timestamps in seconds):
${JSON.stringify(segments, null, 2)}

Please map each lyric/script line to its corresponding audio interval.
Guidelines:
1. Map lines sequentially. Each subsequent line should generally start after or near the previous line's end.
2. If there are fewer lyric lines than detected active intervals, map the lyrics to the most prominent intervals (higher peak or duration) and merge remaining silent/quiet zones.
3. If there are more lyric lines than active intervals, split the existing intervals proportionally so every line has a realistic start and end time.
4. Standardize text casing, clean up trailing punctuation, and output the aligned timing.
5. Your output MUST be a JSON array containing objects with the following properties:
   - lineId: number (index of the lyric line starting from 1)
   - text: string (the aligned lyric line)
   - start: number (start time in seconds, precise to 2 decimal places)
   - end: number (end time in seconds, precise to 2 decimal places)

Return ONLY the JSON array matching this schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              lineId: { type: Type.INTEGER },
              text: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
            },
            required: ["lineId", "text", "start", "end"],
          },
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini AI");
    }

    const alignedSegments = JSON.parse(responseText.trim());
    res.json({ segments: alignedSegments });
  } catch (error: any) {
    console.error("Error in /api/align:", error);
    res.status(500).json({ error: error.message || "Failed to perform AI alignment" });
  }
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
