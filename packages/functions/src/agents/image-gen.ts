/**
 * Agent 3 — Image Generation Lambda.
 *
 * Step Functions task: invoked on an image-cache MISS. Calls Amazon Titan
 * Image Generator v2 via Bedrock, uploads the resulting PNG to S3, and
 * returns the CloudFront URL plus the image cache key.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Resource } from 'sst';
import {
  createLogger,
  buildImageGenPrompt,
  buildImageGenNegativePrompt,
  buildS3ImageKey,
} from '@uweather/core';
import type { ConsensusForecast, TimeSlot } from '@uweather/core';

const bedrock = new BedrockRuntimeClient({});
const s3 = new S3Client({});
const log = createLogger({ function: 'agent-image-gen' });

/** Amazon Titan Image Generator v2 model ID */
const TITAN_MODEL_ID = 'amazon.titan-image-generator-v2:0';

export interface ImageGenInput {
  city: string;
  date: string;
  timeSlot: TimeSlot;
  consensus: ConsensusForecast;
  /** Pre-computed cache key from CheckImageCache — reused to name the S3 object */
  imageCacheKey: string;
}

export interface ImageGenOutput {
  imageUrl: string;
  imageCacheKey: string;
}

export async function handler(input: ImageGenInput): Promise<ImageGenOutput> {
  log.info('Agent3_ImageGen starting', {
    city: input.city,
    timeSlot: input.timeSlot,
    condition: input.consensus.condition,
    imageCacheKey: input.imageCacheKey,
  });

  const prompt = buildImageGenPrompt({
    consensus: input.consensus,
    city: input.city,
    timeSlot: input.timeSlot,
  });

  const negativePrompt = buildImageGenNegativePrompt();

  // Invoke Titan Image Generator v2
  const bedrockResponse = await log.timed('Bedrock Titan - image-gen', () =>
    bedrock.send(
      new InvokeModelCommand({
        modelId: TITAN_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          taskType: 'TEXT_IMAGE',
          textToImageParams: {
            text: prompt,
            negativeText: negativePrompt,
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            quality: 'standard',
            width: 1024,
            height: 512,
            cfgScale: 8.0,
          },
        }),
      }),
    ),
  );

  const responseBody = JSON.parse(
    new TextDecoder().decode((bedrockResponse as { body: Uint8Array }).body),
  ) as { images: string[]; error?: string | null };

  if (responseBody.error) {
    throw new Error(`Titan image generation error: ${responseBody.error}`);
  }

  const base64Image = responseBody.images[0];
  if (!base64Image) {
    throw new Error('Agent3_ImageGen: Titan returned no images');
  }

  // Decode base64 → Buffer and upload to S3
  const imageBuffer = Buffer.from(base64Image, 'base64');
  const s3Key = buildS3ImageKey(input.imageCacheKey);

  await log.timed('S3 PutObject - image upload', () =>
    s3.send(
      new PutObjectCommand({
        Bucket: Resource.UweatherImages.name,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=86400', // 24-hour browser cache
      }),
    ),
  );

  // Build the CloudFront URL from the CDN domain
  const imageUrl = `https://${Resource.ImagesCdn.url}/${s3Key}`;

  log.info('Image generated and uploaded', {
    city: input.city,
    imageCacheKey: input.imageCacheKey,
    s3Key,
    imageUrl,
  });

  return { imageUrl, imageCacheKey: input.imageCacheKey };
}
