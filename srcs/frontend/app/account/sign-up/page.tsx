import { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/form/SignUpForm";

export const metadata: Metadata = {
	title: "Sign Up"
}

export default function AccountSignUpPage() {
	return (
		<div>
			<p>Create Account</p>
			<p>Please sign-up using account detail below.</p>
			<SignUpForm />
			{/* <Link href="/account/whoami" style={{backgroundColor: '#f6f7fb'}}>Sign Up</Link> */}
			<p>Already have an Account? <Link href="/login">Log In</Link></p>
		</div>
	);
}
