import { redirect } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";

export async function LoginUserAction(formData: FormData) {
	const email = formData.get("email");
	const password = formData.get("password");

	const response = await fetch(`${LOGIN_URL}/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			Email: email,
			Password: password,
		}),
		credentials: 'include'
	});
	if (response.ok) redirect('/');
	else console.log('fetch error');
}
