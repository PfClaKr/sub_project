import AppTheme from "@/theme/ui";
import styled from "styled-components";

export const Thumb = styled.img`
	position: absolute;
	background-image: url('');
	background-repeat: no-repeat;
	width: 100%;
	height: 100%;
	border-radius: 4px;
	top: 0;
	left: 0;
	margin: auto;
	object-fit: cover;
	transform: translate(50, 50);
`;

export const ThumbContainer = styled.div`
	position: relative;
	width: 332px;
	height: 344px;
`;

export const InfoContainer = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: auto;
`;

export const Title = styled.div`
	color: ${AppTheme.product.text.secondary.color};
	font-size: ${AppTheme.product.text.secondary.size};
	font-weight: ${AppTheme.product.text.secondary.weight};
	overflow: hidden;
	margin: auto;
`;

export const Price = styled.div`
	color: ${AppTheme.product.text.primary.color};
	font-size: ${AppTheme.product.text.primary.size};
	font-weight: ${AppTheme.product.text.primary.weight};
	overflow: hidden;
	margin: auto;
`;

export const Subtitle = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	color: ${AppTheme.product.text.sub.color};
	font-size: ${AppTheme.product.text.sub.size};
	font-weight: ${AppTheme.product.text.sub.weight};
	overflow: hidden;
	margin: auto;
`;

export const Card = styled.div`
	display: flex;
	flex-direction: column;
	align-content: space-between;
	width: 332px;
	height: 476px;
	border-radius: 4px;
	background-color: ${AppTheme.product.bg.normal};
`;
