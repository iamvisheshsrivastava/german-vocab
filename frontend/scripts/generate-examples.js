#!/usr/bin/env node
// One-time batch generator for src/data/examples.json — pre-bakes a German
// example sentence + English translation for every word in vocabulary.json
// via OpenRouter, so the Learn tab never has to wait on a live LLM call.
// Resumable: re-running it only requests ids missing from the output file.
const fs = require("fs");
const path = require("path");

function loadEnvKey(name) {
  const envPath = path.join(__dirname, "..", ".env");
  const content = fs.readFileSync(envPath, "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in .env`);
  return line.slice(name.length + 1).trim();
}

const API_KEY = loadEnvKey("EXPO_PUBLIC_OPENROUTER_API_KEY");
const MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
];
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const BATCH_SIZE = 15;
const CONCURRENCY = 3;
const TIMEOUT_MS = 60000;

const VOCAB_PATH = path.join(__dirname, "..", "src/data/vocabulary.json");
const OUT_PATH = path.join(__dirname, "..", "src/data/examples.json");

const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, "utf8"));
const existing = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, "utf8")) : {};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function callModel(model, words) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              'You are generating study material for a German A1/A2 vocabulary app. For each numbered word below, write ONE short, simple German example sentence (A1/A2 level) using that word\'s German translation naturally, plus its English translation. Respond with ONLY a JSON array, no other text, no markdown fences, in this exact shape: [{"id":<id>,"sentence":"<german sentence>","translation":"<english translation>"}]. Include every id given, in any order.',
          },
          {
            role: "user",
            content: words.map((w) => `id ${w.id}: "${w.english}" = "${w.german}"`).join("\n"),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, status: "no_content" };
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { ok: false, status: "no_json" };
    const parsed = JSON.parse(jsonMatch[0]);
    return { ok: true, parsed };
  } catch (e) {
    return { ok: false, status: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

let savePending = false;
function scheduleSave() {
  savePending = true;
}
function flushSave() {
  if (!savePending) return;
  fs.writeFileSync(OUT_PATH, JSON.stringify(existing));
  savePending = false;
}

async function processBatch(batch, attempt = 0) {
  const model = MODELS[Math.min(attempt, MODELS.length - 1)];
  const result = await callModel(model, batch);

  if (result.ok) {
    let count = 0;
    for (const item of result.parsed) {
      if (
        item &&
        typeof item.id === "number" &&
        typeof item.sentence === "string" &&
        typeof item.translation === "string" &&
        item.sentence.trim() &&
        item.translation.trim()
      ) {
        existing[String(item.id)] = { sentence: item.sentence.trim(), translation: item.translation.trim() };
        count++;
      }
    }
    scheduleSave();
    console.log(`[ok] ids ${batch[0].id}-${batch[batch.length - 1].id}: ${count}/${batch.length} via ${model}`);
    const gotIds = new Set(result.parsed.filter((i) => i && typeof i.id === "number").map((i) => i.id));
    const missing = batch.filter((w) => !gotIds.has(w.id));
    if (missing.length > 0 && attempt < 3) {
      await processBatch(missing, attempt + 1);
    }
    return;
  }

  console.warn(`[fail] ids ${batch[0].id}-${batch[batch.length - 1].id} (${result.status}) via ${model}, attempt ${attempt}`);
  if (attempt >= 4) {
    console.error(`[giving up] ids: ${batch.map((w) => w.id).join(",")}`);
    return;
  }
  if (batch.length > 5) {
    const mid = Math.ceil(batch.length / 2);
    await processBatch(batch.slice(0, mid), attempt + 1);
    await processBatch(batch.slice(mid), attempt + 1);
  } else {
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    await processBatch(batch, attempt + 1);
  }
}

async function runWithConcurrency(items, limit, worker) {
  let idx = 0;
  async function next() {
    const i = idx++;
    if (i >= items.length) return;
    await worker(items[i]);
    await next();
  }
  await Promise.all(Array.from({ length: limit }, () => next()));
}

(async () => {
  const remaining = vocab.filter((w) => !existing[String(w.id)]);
  console.log(
    `Total words: ${vocab.length}, already have: ${vocab.length - remaining.length}, generating: ${remaining.length}`,
  );
  const batches = chunk(remaining, BATCH_SIZE);
  let done = 0;
  const saveTimer = setInterval(flushSave, 5000);
  await runWithConcurrency(batches, CONCURRENCY, async (batch) => {
    await processBatch(batch);
    done++;
    console.log(`progress: ${done}/${batches.length} batches`);
  });
  clearInterval(saveTimer);
  flushSave();
  const finalCount = Object.keys(existing).length;
  console.log(`DONE. ${finalCount}/${vocab.length} words have examples.`);
})();
