'use client';

import { useState, ChangeEvent, FormEvent } from "react";
import { RegisterUserAction } from "./RegisterUserAction"; 

export const SignUpForm = () => {
	return (
		<form action={RegisterUserAction}>
			<input type="text" placeholder="Email" name="email" /><br/>
			<input type="password" placeholder="Password" name="password" /><br/>
			<input type="text" placeholder="Nickname" name="nickname" /><br/>
			<button type="submit">Sign Up</button>
		</form>
	);
};
