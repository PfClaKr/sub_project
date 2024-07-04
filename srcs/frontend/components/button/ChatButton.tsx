'use client';

import { useRouter } from "next/navigation";

export const ChatButton = () => {
	const router = useRouter();

	const handleClick = () => {
		return router.push('/chat');
	}

	return (
		<button onClick={handleClick}>채팅하기</button>
	);
}
