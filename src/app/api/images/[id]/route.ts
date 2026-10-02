import { deleteSavedImage, updateSavedImage } from "@/lib/db";
import { imageMetadata } from "@/lib/image-library";

type Context = { params: Promise<{ id: string }> };
function validId(id: string): boolean { return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)); }

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const metadata = imageMetadata(await request.json().catch(() => null));
  if (!validId(id) || !metadata) return Response.json({ error: "Invalid image name, description, or ID." }, { status: 400 });
  const image = updateSavedImage(Number(id), metadata.name, metadata.description);
  return image ? Response.json(image) : Response.json({ error: "Image not found." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!validId(id)) return Response.json({ error: "Invalid image ID." }, { status: 400 });
  return deleteSavedImage(Number(id)) ? Response.json({ success: true }) : Response.json({ error: "Image not found." }, { status: 404 });
}
