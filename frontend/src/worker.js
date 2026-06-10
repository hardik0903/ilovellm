import { pipeline, env } from '@xenova/transformers';

// Skip local check to only use Hugging Face Hub
env.allowLocalModels = false;

// We use a singleton pattern for the pipeline to avoid loading it multiple times
class PipelineSingleton {
    static task = 'text2text-generation';
    static model = 'Xenova/LaMini-Flan-T5-783M';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { 
                progress_callback,
                dtype: 'q4' // Use highly quantized 4-bit model to save browser RAM
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, text } = event.data;
    
    if (type === 'load') {
        // Just preload the model
        try {
            await PipelineSingleton.getInstance((x) => {
                self.postMessage({ status: 'progress', data: x });
            });
            self.postMessage({ status: 'ready' });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    } else if (type === 'generate') {
        // Run generation
        try {
            const generator = await PipelineSingleton.getInstance((x) => {
                self.postMessage({ status: 'progress', data: x });
            });
            
            self.postMessage({ status: 'processing' });
            
            // Format prompt for T5 (Encoder-Decoder architecture)
            // T5 doesn't need system tags, just plain instructions.
            const prompt = `Instruction: Answer the user's question based on the following conversation and context.\n\n${text}`;

            const output = await generator(prompt, {
                max_new_tokens: 128,
                temperature: 0.7,
                do_sample: true,
                // We use a callback to stream tokens back
                callback_function: (beams) => {
                    const decodedText = generator.tokenizer.decode(beams[0].output_token_ids, { skip_special_tokens: true });
                    self.postMessage({ status: 'update', output: decodedText });
                }
            });

            // For T5, the generated text is just the answer directly
            const finalResult = output[0].generated_text;

            self.postMessage({ status: 'complete', output: finalResult.trim() });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
});
