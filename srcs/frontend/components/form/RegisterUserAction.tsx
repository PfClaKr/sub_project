// "use server";

export async function RegisterUserAction(formData: FormData) {
	const email = formData.get("email");
	const password = formData.get("password");
	const nickname = formData.get("nickname");

	console.log("user data: ", email, password, nickname);

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
	if (response.ok) console.log('res: ', response.json());
	else console.log('fetch error');
}
