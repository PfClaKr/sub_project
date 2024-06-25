import { Metadata } from "next";

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
			<p>Don't have an Account? Create Account</p>
		</div>
	);
}
