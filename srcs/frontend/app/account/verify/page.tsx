import { Metadata } from "next";
import { VerifyResult } from "@/components/auth/VerifyResult";

export const metadata: Metadata = {
	title: "이메일 인증",
};

export default function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
	return <VerifyResult token={searchParams.token} />;
}
