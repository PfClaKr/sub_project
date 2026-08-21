'use client';

import styled from "styled-components";

export const DisplayTrayContainer = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
	gap: 20px;
	width: 100%;
`;

export const Container = styled.div`
	min-width: 0;
`;
