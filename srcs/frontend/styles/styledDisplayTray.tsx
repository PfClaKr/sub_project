'use client';

import styled from "styled-components";

export const DisplayTrayContainer = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
	gap: 20px;
	width: 100%;

	/* Two columns on phones instead of one oversized card. */
	@media (max-width: 600px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
`;

export const Container = styled.div`
	min-width: 0;
`;
