"use client";

import { useState, ChangeEvent } from "react";

export const SignUpForm = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [nickname, setNickname] = useState("");

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const inputValue = event.target.value;
		if (event.target.id === "userEmail") setEmail(inputValue);
		else if (event.target.id === "userPassword") setPassword(inputValue);
		else if (event.target.id === "userNickname") setNickname(inputValue);
	};

	const handleSearch = async () => {
		if (email && email.endsWith("@gmail.com")) {
			console.log("email correct format");
		} else {
			console.log("email wrong format");
			return;
		}
		if (password && password.length > 4) {
			console.log("password correct format");
		} else {
			console.log("password does not match the requirement");
			return;
		}
		if (nickname) {
			console.log("nickname correct format");
		} else {
			console.log("nickname wrong format");
			return;
		}
		alert("sign up request success");

		const response = await fetch("http://golang:8080/graphql", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: `
					mutation {
						createUser(Email: \"example@example.com\",
						PasswordHash: \"hashedpassword\",
						UserNickname: \"exampleuser\") { UserId }
					}
				`,
			}),
		});
		return;
	};

	const handleKeyPress = (event: { key: any }) => {
		if (event.key === "Enter") return;
	};

	return (
		<div>
			<p>Email</p>
			<input
				type="text"
				placeholder="Email Address"
				id="userEmail"
				value={email ?? ""}
				onChange={handleChange}
				onKeyDown={handleKeyPress}
			/>
			<p>Password</p>
			<input
				type="password"
				placeholder="Password"
				id="userPassword"
				value={password ?? ""}
				onChange={handleChange}
				onKeyDown={handleKeyPress}
			/>
			<p>Nickname</p>
			<input
				type="text"
				placeholder="Dwayne Johnson"
				id="userNickname"
				value={nickname ?? ""}
				onChange={handleChange}
				onKeyDown={handleKeyPress}
			/>
			<button onClick={handleSearch}>Sign Up</button>
		</div>
	);
};
