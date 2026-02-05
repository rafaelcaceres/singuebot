"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";

/**
 * Transcribe audio from WhatsApp using OpenAI Whisper API
 * This function downloads audio from Twilio and transcribes it to text
 */
export const transcribeAudio = internalAction({
  args: {
    mediaUrl: v.string(),
    mediaContentType: v.string(),
    twilioAccountSid: v.string(),
    twilioAuthToken: v.string(),
  },
  returns: v.object({
    transcription: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    processingTimeMs: v.number(),
    audioMetadata: v.optional(v.object({
      duration: v.optional(v.number()),
      fileSize: v.optional(v.number()),
      format: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      console.log("🎵 AudioTranscription: Starting transcription for", args.mediaUrl);

      // Validate OpenAI API key
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OpenAI API key not configured");
      }

      // Download audio from Twilio with authentication
      console.log("📥 AudioTranscription: Downloading audio from Twilio");
      const audioResponse = await fetch(args.mediaUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(`${args.twilioAccountSid}:${args.twilioAuthToken}`)}`,
        },
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: args.mediaContentType });

      console.log(`📊 AudioTranscription: Audio downloaded - ${audioBuffer.byteLength} bytes, type: ${args.mediaContentType}`);

      // Prepare form data for OpenAI Whisper API
      const formData = new FormData();

      // Determine file extension based on content type
      const getFileExtension = (contentType: string): string => {
        const typeMap: Record<string, string> = {
          "audio/ogg": "ogg",
          "audio/mpeg": "mp3",
          "audio/mp4": "mp4",
          "audio/wav": "wav",
          "audio/webm": "webm",
          "audio/amr": "amr",
        };
        return typeMap[contentType] || "ogg"; // Default to ogg for WhatsApp
      };

      const fileExtension = getFileExtension(args.mediaContentType);
      const fileName = `whatsapp_audio.${fileExtension}`;

      formData.append("file", audioBlob, fileName);
      formData.append("model", "whisper-1");
      formData.append("language", "pt"); // Portuguese for Brazilian WhatsApp
      formData.append("response_format", "json");

      console.log("🤖 AudioTranscription: Sending to OpenAI Whisper API");

      // Call OpenAI Whisper API
      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        throw new Error(`OpenAI Whisper API error: ${transcriptionResponse.status} - ${errorText}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      const transcribedText = transcriptionResult.text?.trim() || "";

      if (!transcribedText) {
        throw new Error("No transcription text returned from OpenAI");
      }

      const processingTime = Date.now() - startTime;

      console.log(`✅ AudioTranscription: Success - "${transcribedText}" (${processingTime}ms)`);

      return {
        transcription: transcribedText,
        success: true,
        processingTimeMs: processingTime,
        audioMetadata: {
          fileSize: audioBuffer.byteLength,
          format: args.mediaContentType,
          duration: transcriptionResult.duration,
        },
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error("❌ AudioTranscription: Failed to transcribe audio:", errorMessage);

      return {
        transcription: "",
        success: false,
        error: errorMessage,
        processingTimeMs: processingTime,
      };
    }
  },
});

/**
 * Helper function to detect if a message contains audio
 */
export const isAudioMessage = (mediaContentType?: string): boolean => {
  if (!mediaContentType) return false;
  
  const audioTypes = [
    "audio/ogg",
    "audio/mpeg", 
    "audio/mp4",
    "audio/wav",
    "audio/webm",
    "audio/amr",
  ];
  
  return audioTypes.some((type: any) => mediaContentType.toLowerCase().includes(type));
};