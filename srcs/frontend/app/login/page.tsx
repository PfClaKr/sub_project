import { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/form/SignInForm";

export const metadata: Metadata = {
	title: "login"
}

export default function LoginPage() {
	return (
		<div>
			<p>Login</p>
			<p>Please login using account detail below.</p>
			<SignInForm/>
			<p>Forgot your password?</p>
			<p>Don't have an Account? <Link href="/account/sign-up">Create Account</Link></p>
		</div>
	);
}
