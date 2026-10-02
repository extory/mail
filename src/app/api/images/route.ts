import { getSavedImages, saveImage } from "@/lib/db";
import { imageMetadata, isExistingUpload } from "@/lib/image-library";

export async function GET() {
  return Response.json(getSavedImages(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const metadata = imageMetadata(body);
  if (!metadata) return Response.json({ error: "A name of up to 120 characters is required; description must be at most 1000 characters." }, { status: 400 });
  if (!await isExistingUpload(body.url)) return Response.json({ error: "Upload an image before saving it to the library." }, { status: 400 });
  return Response.json(saveImage(body.url, metadata.name, metadata.description));
}
