import { pipeline, env } from "@xenova/transformers";

// Disable local models to fetch from Hugging Face CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = "text2text-generation";
  // LaMini-Flan-T5-77M is extremely small (~90MB) and fast for browser-based summarization
  static model = "Xenova/LaMini-Flan-T5-77M";
  static instance: any = null;

  static async getInstance(progress_callback?: Function) {
    if (this.instance === null) {
      this.instance = pipeline(this.task as any, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  const { text } = event.data;
  
  if (!text) return;

  try {
    const generator = await PipelineSingleton.getInstance((progress: any) => {
      self.postMessage({ status: "progress", progress });
    });

    const output = await generator(text, {
      max_new_tokens: 64,
      temperature: 0.7,
      repetition_penalty: 1.2,
    });

    self.postMessage({
      status: "complete",
      result: output[0]?.generated_text || "A business dataset.",
    });
  } catch (error: any) {
    self.postMessage({ status: "error", error: error.message });
  }
});
