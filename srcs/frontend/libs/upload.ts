import { API_URL } from "@/libs/config";
import { MAX_IMAGES, MAX_IMAGE_BYTES } from "@/libs/constants";
import { libText } from "@/libs/libText";

// uploadImages stores files via the apiserver and returns their URLs.
// Throws an Error with a user-facing message.
export async function uploadImages(files: File[]): Promise<string[]> {
	if (files.length === 0) return [];
	if (files.length > MAX_IMAGES) throw new Error(libText("tooMany", { max: MAX_IMAGES }));
	if (files.some(f => f.size > MAX_IMAGE_BYTES)) throw new Error(libText("tooBig"));

	const formData = new FormData();
	files.forEach(file => formData.append("image", file));
	let res: Response;
	try {
		res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData, credentials: "include" });
	} catch {
		throw new Error(libText("uploadFailed"));
	}
	if (res.status === 401) throw new Error(libText("loginNeeded"));
	if (!res.ok) throw new Error(libText("uploadFormat"));
	const json = await res.json();
	return json.urls ?? [];
}
