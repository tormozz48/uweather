import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  buildImageGenNegativePrompt,
  buildImageGenPrompt,
  buildS3ImageKey,
  createLogger,
  emitMetric,
} from '@uweather/core';
import type { ConsensusForecast, TimeSlot } from '@uweather/core';
import type { Context } from 'aws-lambda';
import { Resource } from 'sst';
import { reportStage } from '../lib/report-stage.js';

const s3 = new S3Client({});
const log = createLogger({ function: 'agent-image-gen' });

const PIXAZO_SDXL_URL = 'https://gateway.pixazo.ai/getImage/v1/getSDXLImage';

export interface ImageGenInput {
  city: string;
  date: string;
  timeSlot: TimeSlot;
  consensus: ConsensusForecast;
  /** Pre-computed cache key from CheckImageCache — reused to name the S3 object */
  imageCacheKey: string;
  /** Landmark resolved by the ResolveLandmark pipeline step. */
  landmark: string;
  executionArn?: string;
}

export interface ImageGenOutput {
  imageUrl: string;
  imageCacheKey: string;
}

/** Call the Pixazo SDXL v1.0 API and return the hosted image URL it provides. */
async function generateImageWithPixazo(prompt: string, negativePrompt: string): Promise<string> {
  const response = await fetch(PIXAZO_SDXL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Ocp-Apim-Subscription-Key': Resource.PixazoApiKey.value,
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      height: 1024,
      width: 1024,
      num_steps: 20,
      guidance_scale: 7,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Pixazo API error: ${response.status} ${response.statusText} — ${body}`);
  }

  const data = (await response.json()) as { imageUrl?: string };
  if (!data.imageUrl) {
    throw new Error('Agent3_ImageGen: Pixazo returned no imageUrl');
  }
  return data.imageUrl;
}

/** Infer a MIME type from a URL's file extension, defaulting to PNG. */
function inferContentType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

/** Download a remote image and return its buffer plus MIME type. */
async function downloadImage(url: string): Promise<{ imageBuffer: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from Pixazo CDN: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return { imageBuffer: Buffer.from(arrayBuffer), contentType: inferContentType(url) };
}

/** Upload an image buffer to S3 and return its CloudFront URL. */
async function uploadToS3(
  s3Key: string,
  imageBuffer: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: Resource.UweatherImages.name,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=86400', // 24-hour browser cache
    }),
  );
  return `${Resource.ImagesCdn.url}/${s3Key}`;
}

/**
 * Agent 3 — Image Generation Lambda.
 *
 * Step Functions task: invoked on an image-cache MISS. Calls the Pixazo AI
 * Stable Diffusion XL v1.0 API (free tier), downloads the resulting image,
 * uploads it to S3, and returns the CloudFront URL plus the image cache key.
 *
 * API reference: https://www.pixazo.ai/models/stable-diffusion
 * Endpoint: POST https://gateway.pixazo.ai/getImage/v1/getSDXLImage
 * Auth header: Ocp-Apim-Subscription-Key
 */
export async function handler(input: ImageGenInput, context: Context): Promise<ImageGenOutput> {
  const reqLog = log.child({
    requestId: context.awsRequestId,
    city: input.city,
    imageCacheKey: input.imageCacheKey,
  });

  if (input.executionArn) await reportStage(input.executionArn, 'image_gen', 'started');
  reqLog.info('Agent3_ImageGen starting', {
    timeSlot: input.timeSlot,
    condition: input.consensus.condition,
  });

  const prompt = buildImageGenPrompt({
    consensus: input.consensus,
    city: input.city,
    timeSlot: input.timeSlot,
    landmark: input.landmark,
  });
  const negativePrompt = buildImageGenNegativePrompt();

  const pixazoImageUrl = await reqLog.timed('Pixazo SDXL - image-gen', () =>
    generateImageWithPixazo(prompt, negativePrompt),
  );
  reqLog.info('Pixazo image URL received', { pixazoImageUrl });

  const { imageBuffer, contentType } = await reqLog.timed('Download image from Pixazo CDN', () =>
    downloadImage(pixazoImageUrl),
  );

  const s3Key = buildS3ImageKey(input.imageCacheKey);
  const imageUrl = await reqLog.timed('S3 PutObject - image upload', () =>
    uploadToS3(s3Key, imageBuffer, contentType),
  );

  reqLog.info('Image generated and uploaded', { s3Key, imageUrl });

  // Track image generation count for cost monitoring
  emitMetric('ImageGenerationCount', 1);

  if (input.executionArn) await reportStage(input.executionArn, 'image_gen', 'done');
  return { imageUrl, imageCacheKey: input.imageCacheKey };
}
