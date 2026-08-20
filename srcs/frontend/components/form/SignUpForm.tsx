'use client';

import { RegisterUserAction } from "./RegisterUserAction";
import { FormColumn } from "@/styles/styledForm";

export const SignUpForm = () => {
	return (
		<FormColumn action={RegisterUserAction}>
			<input type="text" placeholder="Email" name="email" required />
			<input type="password" placeholder="Password" name="password" required />
			<input type="text" placeholder="Nickname" name="nickname" required />
			<button type="submit">가입하기</button>
		</FormColumn>
	);
};
