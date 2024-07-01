export function UserInformation(props: any) {
    return (
        <div>
            <p>판매자 정보</p>
            <img src={props.profileImage[0]} />
            <p>{props.userNickname}</p>
            <p>팔로우</p>
            <p>게시 상품수 {props.publishedQuantity}</p>
            <button>둘러보기</button>
        </div>
    );
}