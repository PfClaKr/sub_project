import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Sign Up"
}

export default function AccountWhoAmIPage() {
	return (
		<div>
			<p>Please Enter Your Information</p>
			{/* <p>First Name</p>
			<input placeholder="Gildong"></input><br/>
			<p>Last Name</p>
			<input placeholder="Hong"></input><br/>
			<p>Phone Number</p>
			<input placeholder="+33 ..."></input><br/> */}
			<p>Email</p>
			<input placeholder="random@gmail.com"></input><br/>
			<p>Nickname</p>
			<input placeholder="Masterpiece42"></input><br/>
			{/* <p>District (France/Paris)</p>
			<input placeholder="16eme"></input><br/> */}
		</div>
	);
}
