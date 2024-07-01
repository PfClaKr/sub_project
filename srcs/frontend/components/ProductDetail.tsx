import { ChatButton } from "./ChatButton"

export function convertUnixToParisTime(unixTime: number) {
  const date = new Date(unixTime * 1000);

  const options = {
    timeZone: 'Europe/Paris',
    year: 'numeric' as const,
    month: '2-digit'as const,
    day: '2-digit' as const,
    hour: '2-digit' as const,
    minute: '2-digit' as const,
    hour12: false as const,
  };

  const formatter = new Intl.DateTimeFormat('en-GB', options);

  // 포맷된 날짜와 시간 얻기
  const [
    { value: day },,
    { value: month },,
    { value: year },,
    { value: hour },,
    { value: minute }
  ] = formatter.formatToParts(date);

  return `${year}-${month}-${day}, ${hour}:${minute}`;
}

export function ProductDetail(props: any) {
    return (
        <div>
            <img src={props.productImage[0]} />
            <div>
                <p>카테고리 &gt; 가구 &gt; 의자</p>
                <p>관심목록 저장</p>
                <p><strong>{props.productName}</strong></p>
                <ul>
                    <li><p>가격 {props.productPrice}&euro;</p></li>
                    <li><p>지역 {props.preferedLocation};</p></li>
                    <li><p>카테고리 {props.productCategory}</p></li>
                    <li><p>상태 {props.productPrice}</p></li>
                    <li><p>사이즈 {props.productPrice}</p></li>
                    <li><p>게시일 {convertUnixToParisTime(props.productCreatedAt)}</p></li>
                </ul>
                <ChatButton/>
            </div>
        </div>
    )
}