'use client';

import { LoginUserAction } from "./LoginUserAction";

export const SignInForm = () => {
	return (
		<form action={LoginUserAction}>
			<input type="text" placeholder="Email" name="email" /><br/>
			<input type="password" placeholder="Password" name="password" /><br/>
			<button type="submit">Sign In</button>
		</form>
	);
};
