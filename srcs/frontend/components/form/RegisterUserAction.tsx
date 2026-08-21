import { redirect } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";

export async function RegisterUserAction(formData: FormData) {
	const email = formData.get("email");
	const password = formData.get("password");
	const nickname = formData.get("nickname");
	const residence = formData.get("residence");
	const residenceDetail = formData.get("residencedetail");

	const response = await fetch(`${LOGIN_URL}/signup`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			Email: email,
			Password: password,
			UserNickname: nickname,
			Residence: residence,
			ResidenceDetail: residenceDetail,
		}),
	});
	if (response.ok) redirect('/account/verify-sent');
	else console.log('fetch error');
}
