'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const ProfileCard = styled.div`
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 20px;
	border-radius: 12px;
	background-color: ${palette.bg[100]};
	margin-bottom: 28px;

	img {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		object-fit: cover;
	}
`;

export const ProfileName = styled.div`
	font-size: 18px;
	font-weight: 700;
`;

export const ListingRow = styled.li`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 14px 4px;
	border-bottom: 1px solid ${palette.bg[300]};

	a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const ListingList = styled.ul`
	list-style: none;
	margin: 0;
	padding: 0;
`;

export const ListingStatus = styled.span<{ $status?: string }>`
	font-size: 12px;
	font-weight: 700;
	padding: 3px 10px;
	border-radius: 10px;
	white-space: nowrap;
	color: ${p => (p.$status === "판매완료" ? "#ffffff" : palette.fg[500])};
	background-color: ${p => (p.$status === "판매완료" ? palette.fg[100] : palette.bg[300])};
`;

export const DangerButton = styled.button`
	background-color: #ffffff;
	color: #c0392b;
	border: 1px solid #e6b3ac;

	&:hover {
		background-color: #fdf0ee;
	}
`;
