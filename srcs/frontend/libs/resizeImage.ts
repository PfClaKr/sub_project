import { MAX_IMAGE_SIDE } from "@/libs/constants";

// Photos are shrunk in the browser before upload: a phone photo (12 MP,
// 3–5 MB) becomes about 1600 px and 300–500 KB, so uploads are quick on
// mobile data and lists stay light. Drawing on a canvas also applies the
// EXIF rotation and leaves the metadata (GPS position) behind. The
// apiserver does the same for anything that arrives bigger
// (uploadhandler/images.go) and makes the list thumbnails.

const QUALITY = 0.85;

// fitWithin returns the size with the long edge at most max, keeping the
// aspect ratio; smaller images keep their size.
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
	const long = Math.max(width, height);
	if (long <= max) return { width, height };
	const scale = max / long;
	return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// resizeForUpload returns a JPEG (PNG when the source may be transparent)
// no larger than MAX_IMAGE_SIDE. GIFs (animation) and files the browser
// cannot decode go up as they are; the server decides.
export async function resizeForUpload(file: File): Promise<File> {
	if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		return file;
	}
	try {
		const { width, height } = fitWithin(bitmap.width, bitmap.height);
		// Already small: keep it (the server applies the rotation and
		// drops the metadata of JPEGs anyway).
		if (width === bitmap.width && file.size < 600 * 1024) return file;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return file;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(bitmap, 0, 0, width, height);
		const type = file.type === "image/png" ? "image/png" : "image/jpeg";
		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, QUALITY));
		if (!blob || (blob.size >= file.size && width === bitmap.width)) return file;
		const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/png" ? ".png" : ".jpg");
		return new File([blob], name, { type });
	} finally {
		bitmap.close();
	}
}
