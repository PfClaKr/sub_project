import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Sign Up"
}

export default function AccountSignUpPage() {
	return (
		<div>
			<p>Create Account</p>
			<p>Please sign-up using account detail below.</p>
			<input placeholder="Email Address"></input><br/>
			<input placeholder="Password"></input><br/>
			<input placeholder="Password"></input><br/>
			{/* <button>Sign Up</button> */}
			<Link href="/account/whoami" style={{backgroundColor: '#f6f7fb'}}>Sign Up</Link>
			<p>Already have an Account? <Link href="/login">Log In</Link></p>
		</div>
	);
}
