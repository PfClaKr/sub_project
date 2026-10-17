import { Metadata } from "next";
import { ResetForm } from "@/components/auth/PasswordForms";
import { AuthCard } from "@/styles/styledForm";

export const metadata: Metadata = { title: "새 비밀번호 정하기", robots: { index: false } };

export default function Page({ searchParams }: { searchParams: { email?: string; token?: string } }) {
	return (
		<AuthCard>
			<h1>새 비밀번호 정하기</h1>
			<p>앞으로 로그인할 때 쓸 비밀번호를 입력해주세요.</p>
			<ResetForm email={searchParams.email ?? ""} token={searchParams.token ?? ""} />
		</AuthCard>
	);
}
