'use client';

import { useEffect, useState } from "react";
import styled from "styled-components";
import palette from "@/theme/colorPalette";
import { LOGIN_URL } from "@/libs/config";

const GoogleLink = styled.a`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	padding: 11px 14px;
	border-radius: 6px;
	border: 1px solid ${palette.bg[500]};
	background-color: #ffffff;
	color: ${palette.fg.default};
	font-size: 14px;
	font-weight: 600;
	text-decoration: none;

	&:hover {
		background-color: ${palette.bg[100]};
	}
`;

const Divider = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	margin: 18px 0;
	color: ${palette.fg[100]};
	font-size: 12px;

	&::before, &::after {
		content: "";
		flex: 1;
		height: 1px;
		background-color: ${palette.bg[500]};
	}
`;

const GoogleMark = () => (
	<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
		<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.7 17.6 9.5 24 9.5z"/>
		<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/>
		<path fill="#FBBC05" d="M10.4 28.1c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C1 16 0 19.9 0 23.5s1 7.5 2.6 10.7l7.8-6.1z"/>
		<path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.4 0-11.7-4.2-13.6-10.2l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z"/>
	</svg>
);

// Only rendered when the server reports OAuth credentials are configured.
export const GoogleButton = ({ label }: { label: string }) => {
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		fetch(`${LOGIN_URL}/auth/google/status`)
			.then(res => res.ok ? res.json() : null)
			.then(json => setEnabled(Boolean(json?.enabled)))
			.catch(() => setEnabled(false));
	}, []);

	if (!enabled) return null;

	return (
		<>
			<GoogleLink href={`${LOGIN_URL}/auth/google/login`}>
				<GoogleMark />
				{label}
			</GoogleLink>
			<Divider>또는</Divider>
		</>
	);
};
