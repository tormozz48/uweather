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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Resource } from 'sst';
import {
  createLogger,
  buildImageGenPrompt,
  buildImageGenNegativePrompt,
  buildS3ImageKey,
} from '@uweather/core';
import type { ConsensusForecast, TimeSlot } from '@uweather/core';

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

  // Call Pixazo SDXL v1.0 API — returns a hosted image URL
  const pixazoImageUrl = await log.timed('Pixazo SDXL - image-gen', async () => {
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
  });

  log.info('Pixazo image URL received', { pixazoImageUrl });

  // Download the generated image from Pixazo's CDN
  const { imageBuffer, contentType } = await log.timed('Download image from Pixazo CDN', async () => {
    const imageResponse = await fetch(pixazoImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image from Pixazo CDN: ${imageResponse.status}`);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Infer content type from the URL extension (Pixazo typically returns PNG)
    const ext = pixazoImageUrl.split('?')[0].split('.').pop()?.toLowerCase();
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      'image/png';
    return { imageBuffer: buffer, contentType: mime };
  });

  const s3Key = buildS3ImageKey(input.imageCacheKey);

  await log.timed('S3 PutObject - image upload', () =>
    s3.send(
      new PutObjectCommand({
        Bucket: Resource.UweatherImages.name,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=86400', // 24-hour browser cache
      }),
    ),
  );

  // Build the CloudFront URL from the CDN domain
  const imageUrl = `${Resource.ImagesCdn.url}/${s3Key}`;

  log.info('Image generated and uploaded', {
    city: input.city,
    imageCacheKey: input.imageCacheKey,
    s3Key,
    imageUrl,
  });

  return { imageUrl, imageCacheKey: input.imageCacheKey };
}
