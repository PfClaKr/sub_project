import { Metadata } from "next";
import { ForgotForm } from "@/components/auth/PasswordForms";
import { AuthCard } from "@/styles/styledForm";

export const metadata: Metadata = { title: "비밀번호 찾기" };

export default function Page() {
	return (
		<AuthCard>
			<h1>비밀번호 찾기</h1>
			<p>가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내드려요.</p>
			<ForgotForm />
		</AuthCard>
	);
}
