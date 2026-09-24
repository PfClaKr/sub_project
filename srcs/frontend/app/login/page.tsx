import { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/form/SignInForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthCard, FormFooter } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";

export const metadata: Metadata = {
	title: "로그인",
};

const OAUTH_ERRORS: Record<string, string> = {
	oauth_user: "Google 계정의 이메일을 확인하지 못했어요. 인증된 이메일이 있는 계정으로 시도해주세요.",
};

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
	const oauthError = searchParams.error?.startsWith("oauth_")
		? OAUTH_ERRORS[searchParams.error] ?? "Google 로그인에 실패했어요. 다시 시도해주세요."
		: "";
	return (
		<AuthCard>
			<h1>로그인</h1>
			<p>다시 만나서 반갑냥!</p>
			{oauthError && <ErrorText role="alert" style={{ marginBottom: 12 }}>{oauthError}</ErrorText>}
			<GoogleButton label="Google로 로그인" />
			<SignInForm next={searchParams.next} />
			<FormFooter>
				아직 계정이 없나요? <Link href="/account/sign-up">회원가입</Link>
			</FormFooter>
		</AuthCard>
	);
}
