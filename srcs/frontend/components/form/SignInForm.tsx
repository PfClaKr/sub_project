'use client';

import { LoginUserAction } from "./LoginUserAction";
import { FormColumn } from "@/styles/styledForm";

export const SignInForm = () => {
	return (
		<FormColumn action={LoginUserAction}>
			<input type="text" placeholder="Email" name="email" required />
			<input type="password" placeholder="Password" name="password" required />
			<button type="submit">로그인</button>
		</FormColumn>
	);
};
