import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "login"
}

export default function LoginPage() {
	return (
		<div>
			<p>Login</p>
			<p>Please login using account detail below.</p>
			<input placeholder="Email Address"></input><br/>
			<input placeholder="Password"></input>
			<p>Forgot your password?</p>
			<button>Sign In</button>
			<p>Don't have an Account? <Link href="/account/sign-up">Create Account</Link></p>
		</div>
	);
}
