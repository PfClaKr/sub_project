import { ChatButton } from "../../button/ChatButton"
import { FavoriteButton } from "../../button/FavoriteButton"
import { StatusSelector } from "./StatusSelector"
import { Gallery } from "./Gallery"
import {
    DetailGrid,
    InfoPanel,
    DetailTitle,
    DetailPrice,
    MetaList,
    ActionRow,
} from "@/styles/styledDetail"

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
        <DetailGrid>
            <Gallery images={props.productImage} alt={props.productName} />
            <InfoPanel>
                <DetailTitle>{props.productName}</DetailTitle>
                <DetailPrice>€ {props.productPrice}</DetailPrice>
                <StatusSelector
                    productId={props.productId}
                    ownerId={props.userId}
                    productStatus={props.productStatus}
                />
                <MetaList>
                    <li><strong>카테고리</strong> {props.productCategory}</li>
                    <li><strong>지역</strong> {props.productRegion ?? "파리"}</li>
                    <li><strong>거래 장소</strong> {props.preferedLocation}</li>
                    <li><strong>게시일</strong> {convertUnixToParisTime(props.productCreatedAt)}</li>
                </MetaList>
                <ActionRow>
                    <ChatButton productId={props.productId}/>
                    <FavoriteButton productId={props.productId}/>
                </ActionRow>
            </InfoPanel>
        </DetailGrid>
    )
}
