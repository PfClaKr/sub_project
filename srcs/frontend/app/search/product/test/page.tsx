import { Metadata } from "next";
import { ChatButton } from "../../../../components/chatButton";

export const metadata: Metadata = {
	title: "Product",
};

export default function ProductDetailPage() {
	return (
		<div>
			<div>
				<p>Product Details</p>
				<p>Home &gt; Pages &gt; Product Details</p>
			</div>
			<div>
				<img src="product_image.jpg" />
				<div>
					<p>카테고리 &gt; 가구 &gt; 의자</p>
					<p>관심목록 저장</p>
					<p><strong>멋들어진 의자</strong></p>
					<ul>
						<li><p>가격 46&euro;</p></li>
						<li><p>지역 파리 5구</p></li>
						<li><p>브랜드 이케아</p></li>
						<li><p>상태 거의 새것</p></li>
						<li><p>사이즈 없음</p></li>
						<li><p>게시일 21.05.2024</p></li>
					</ul>
					<ChatButton/>
				</div>
				<div>
					<p>판매자 정보</p>
					<img src="user_avatar.jpg" />
					<p>82zhyem</p>
					<p>팔로우</p>
					<p>지역 파리 5구</p>
					<p>게시 상품수 3</p>
					<button>둘러보기</button>
				</div>
			</div>
			<div>
				<p>상품설명</p>
				<p>제품명 JYGBB3064</p>
				<p>구매 2022년 3월</p>
				<p>사용횟수 5회 미만</p>
				<p>색상 검정</p>
				<p>손이 잘 안가서 판매합니다<br/>필요하신분 채팅주세요 !</p>
				<iframe src="https://maps.app.goo.gl/ZE7szRhC4cPicALt9"></iframe>
			</div>
			<div>
				<p>이런건 <strong>어떠냥</strong> ?</p>
				<ul>
					<li>item 1</li>
					<li>item 2</li>
					<li>item 3</li>
					<li>item 4</li>
				</ul>
			</div>
		</div>
	);
}
