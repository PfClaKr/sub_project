'use client';

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PasswordBox } from "@/styles/styledForm";
import { useTranslations } from "next-intl";

// A password input whose text can be shown, so typos on a phone keyboard
// are visible before submitting.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
	const t = useTranslations("auth");
	const [visible, setVisible] = useState(false);
	return (
		<PasswordBox>
			<input {...props} type={visible ? "text" : "password"} />
			<button
				type="button"
				onClick={() => setVisible(v => !v)}
				aria-label={visible ? t("hidePassword") : t("showPassword")}
				aria-pressed={visible}
			>
				{visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
			</button>
		</PasswordBox>
	);
}
