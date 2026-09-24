import { API_URL } from "@/libs/config";
import { MAX_IMAGES, MAX_IMAGE_BYTES } from "@/libs/constants";

// uploadImages stores files via the apiserver and returns their URLs.
// Throws an Error with a user-facing message.
export async function uploadImages(files: File[]): Promise<string[]> {
	if (files.length === 0) return [];
	if (files.length > MAX_IMAGES) throw new Error(`사진은 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.`);
	if (files.some(f => f.size > MAX_IMAGE_BYTES)) throw new Error("사진은 한 장에 5MB 이하여야 해요.");

	const formData = new FormData();
	files.forEach(file => formData.append("image", file));
	let res: Response;
	try {
		res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData, credentials: "include" });
	} catch {
		throw new Error("이미지 업로드에 실패했어요.");
	}
	if (res.status === 401) throw new Error("로그인이 필요해요.");
	if (!res.ok) throw new Error("이미지 업로드에 실패했어요. jpg/png/gif/webp만 가능해요.");
	const json = await res.json();
	return json.urls ?? [];
}
