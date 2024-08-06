import { redirect } from "next/navigation";

export async function LoginUserAction(formData: FormData) {
	const email = formData.get("email");
	const password = formData.get("password");

	const response = await fetch("http://127.0.0.1:7070/login", {
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
