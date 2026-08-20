import { redirect } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";

export async function RegisterUserAction(formData: FormData) {
	const email = formData.get("email");
	const password = formData.get("password");
	const nickname = formData.get("nickname");

	const response = await fetch(`${LOGIN_URL}/signup`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			Email: email,
			Password: password,
			UserNickname: nickname
		}),
	});
	if (response.ok) redirect('/');
	else console.log('fetch error');
}
