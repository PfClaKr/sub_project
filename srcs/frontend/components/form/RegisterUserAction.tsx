import { redirect } from "next/navigation";

export async function RegisterUserAction(formData: FormData) {
	const email = formData.get("email");
	const password = formData.get("password");
	const nickname = formData.get("nickname");

	const response = await fetch("http://127.0.0.1:7070/signup", {
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
