'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

const FooterWrap = styled.footer`
	margin-top: 48px;
	background-color: ${palette.bg[500]};
`;

const FooterInner = styled.div`
	max-width: 1120px;
	margin: 0 auto;
	padding: 28px 16px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16px;
	font-size: 13px;
	color: ${palette.fg[700]};
`;

const FooterBrand = styled.div`
	font-size: 16px;
	font-weight: 800;
	color: ${palette.fg[500]};
`;

export default function Footer() {
	return (
		<FooterWrap>
			<FooterInner>
				<div>
					<FooterBrand>itnyang</FooterBrand>
					파리 한인 중고마켓 — 사고팔 물건 있냥?
				</div>
				<div>© {new Date().getFullYear()} itnyang</div>
			</FooterInner>
		</FooterWrap>
	);
}
