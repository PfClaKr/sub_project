export function ProductDescription(props: any) {
    return (
        <div>
            <p>상품설명</p>
            <p>{props.productDescription}</p>
            {/* <iframe src={props.preferedLocation}></iframe> */}
        </div>
    )
}