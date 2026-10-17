'use client';

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PasswordBox } from "@/styles/styledForm";

// A password input whose text can be shown, so typos on a phone keyboard
// are visible before submitting.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
	const [visible, setVisible] = useState(false);
	return (
		<PasswordBox>
			<input {...props} type={visible ? "text" : "password"} />
			<button
				type="button"
				onClick={() => setVisible(v => !v)}
				aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
				aria-pressed={visible}
			>
				{visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
			</button>
		</PasswordBox>
	);
}
