package uploadhandler

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	_ "image/gif" // decoder
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // decoder
)

// Stored photos are at most MaxSide on their long edge, and every photo
// gets a thumbnail of ThumbSide for lists (key <id>_t.jpg, or .png for
// PNG and GIF; frontend libs/format.ts thumbUrl). The site already
// shrinks photos before uploading (libs/resizeImage.ts); this is the
// safety net for other clients and makes the thumbnails.
const (
	MaxSide      = 1600
	ThumbSide    = 640
	maxPixels    = 50_000_000 // refuse decompression bombs before decoding
	jpegQuality  = 82
	thumbQuality = 75
)

var errTooLarge = errors.New("image dimensions too large")

// processed is what gets stored for one upload.
type processed struct {
	data, thumb            []byte
	contentType, thumbType string
	ext, thumbExt          string
}

// process prepares an upload of a known type (allowedTypes):
//   - JPEG is always re-encoded, which drops EXIF metadata (phones write
//     the GPS position there) after applying its orientation;
//   - PNG and WebP are re-encoded when larger than MaxSide (WebP as
//     JPEG, since Go has no WebP encoder);
//   - GIF is kept as uploaded (animation), its first frame gives the
//     thumbnail.
func process(data []byte, contentType string) (processed, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return processed{}, err
	}
	if cfg.Width*cfg.Height > maxPixels {
		return processed{}, errTooLarge
	}
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return processed{}, err
	}
	orientation := 1
	if contentType == "image/jpeg" {
		orientation = jpegOrientation(data)
	}

	out := processed{data: data, contentType: contentType, ext: allowedTypes[contentType]}
	switch contentType {
	case "image/jpeg":
		out.data, err = encodeJPEG(orient(fit(src, MaxSide), orientation), jpegQuality)
	case "image/png":
		if longEdge(src) > MaxSide {
			out.data, err = encodePNG(fit(src, MaxSide))
		}
	case "image/webp":
		if longEdge(src) > MaxSide {
			out.data, err = encodeJPEG(fit(src, MaxSide), jpegQuality)
			out.contentType, out.ext = "image/jpeg", ".jpg"
		}
	}
	if err != nil {
		return processed{}, err
	}

	thumb := orient(fit(src, ThumbSide), orientation)
	if contentType == "image/png" || contentType == "image/gif" {
		out.thumb, err = encodePNG(thumb)
		out.thumbType, out.thumbExt = "image/png", "_t.png"
	} else {
		out.thumb, err = encodeJPEG(thumb, thumbQuality)
		out.thumbType, out.thumbExt = "image/jpeg", "_t.jpg"
	}
	return out, err
}

func longEdge(img image.Image) int {
	b := img.Bounds()
	return max(b.Dx(), b.Dy())
}

// fit scales img down so its long edge is at most side (never up).
func fit(img image.Image, side int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if max(w, h) <= side {
		return img
	}
	if w >= h {
		w, h = side, max(1, h*side/w)
	} else {
		w, h = max(1, w*side/h), side
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.BiLinear.Scale(dst, dst.Bounds(), img, b, draw.Src, nil)
	return dst
}

// encodeJPEG flattens transparency onto white (JPEG has no alpha).
func encodeJPEG(img image.Image, quality int) ([]byte, error) {
	b := img.Bounds()
	flat := image.NewRGBA(b)
	draw.Draw(flat, b, &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.Draw(flat, b, img, b.Min, draw.Over)
	var buf bytes.Buffer
	err := jpeg.Encode(&buf, flat, &jpeg.Options{Quality: quality})
	return buf.Bytes(), err
}

func encodePNG(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	err := (&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&buf, img)
	return buf.Bytes(), err
}

// orient applies an EXIF orientation (1–8) so the picture is upright.
func orient(img image.Image, o int) image.Image {
	if o < 2 || o > 8 {
		return img
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	ow, oh := w, h
	if o >= 5 {
		ow, oh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, ow, oh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var dx, dy int
			switch o {
			case 2: // mirrored
				dx, dy = w-1-x, y
			case 3: // upside down
				dx, dy = w-1-x, h-1-y
			case 4: // upside down, mirrored
				dx, dy = x, h-1-y
			case 5: // transposed
				dx, dy = y, x
			case 6: // rotated 90° clockwise to view
				dx, dy = h-1-y, x
			case 7: // transverse
				dx, dy = h-1-y, w-1-x
			case 8: // rotated 90° counter-clockwise to view
				dx, dy = y, w-1-x
			}
			dst.Set(dx, dy, img.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

// jpegOrientation reads the EXIF orientation tag of a JPEG, 1 when
// absent or unreadable.
func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return 1
	}
	for i := 2; i+4 <= len(data); {
		if data[i] != 0xFF {
			return 1
		}
		marker := data[i+1]
		size := int(binary.BigEndian.Uint16(data[i+2:]))
		if marker == 0xDA || size < 2 || i+2+size > len(data) {
			return 1 // image data starts: no EXIF before it
		}
		seg := data[i+4 : i+2+size]
		if marker == 0xE1 && len(seg) > 14 && string(seg[:6]) == "Exif\x00\x00" {
			return tiffOrientation(seg[6:])
		}
		i += 2 + size
	}
	return 1
}

func tiffOrientation(t []byte) int {
	var order binary.ByteOrder
	switch string(t[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1
	}
	ifd := int(order.Uint32(t[4:]))
	if ifd+2 > len(t) {
		return 1
	}
	n := int(order.Uint16(t[ifd:]))
	for k := 0; k < n; k++ {
		e := ifd + 2 + 12*k
		if e+12 > len(t) {
			return 1
		}
		if order.Uint16(t[e:]) == 0x0112 {
			if v := int(order.Uint16(t[e+8:])); v >= 1 && v <= 8 {
				return v
			}
			return 1
		}
	}
	return 1
}

// Backfill brings photos stored before process existed in line: it makes
// the missing thumbnails and, with shrink, re-encodes the originals in
// place (same key and URL: at most MaxSide, JPEG metadata dropped).
// Run once after deploying: docker compose exec apiserver /main image-backfill [--shrink]
func Backfill(shrink bool) (thumbs, shrunk int, err error) {
	keys := map[string]bool{}
	err = s3Client.ListObjectsV2Pages(&s3.ListObjectsV2Input{Bucket: aws.String(bucket)}, func(page *s3.ListObjectsV2Output, _ bool) bool {
		for _, o := range page.Contents {
			keys[*o.Key] = true
		}
		return true
	})
	if err != nil {
		return 0, 0, err
	}
	for key := range keys {
		tk := thumbKey(key)
		if tk == "" || (keys[tk] && !shrink) {
			continue
		}
		obj, err := s3Client.GetObject(&s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
		if err != nil {
			return thumbs, shrunk, err
		}
		data, err := io.ReadAll(obj.Body)
		obj.Body.Close()
		if err != nil {
			return thumbs, shrunk, err
		}
		contentType := http.DetectContentType(data)
		if _, ok := allowedTypes[contentType]; !ok {
			continue
		}
		img, err := process(data, contentType)
		if err != nil {
			log.Printf("backfill %s: %v", key, err)
			continue
		}
		if !keys[tk] {
			if err := put(tk, img.thumb, img.thumbType); err != nil {
				return thumbs, shrunk, err
			}
			thumbs++
		}
		// Only originals that need it (too big, or JPEG metadata), so a
		// second run does not re-encode again. The stored type must stay
		// (the URL keeps its extension): a WebP that would become a JPEG
		// is left as it is.
		if shrink && img.contentType == contentType && needsShrink(data, contentType) {
			if err := put(key, img.data, img.contentType); err != nil {
				return thumbs, shrunk, err
			}
			shrunk++
		}
	}
	return thumbs, shrunk, nil
}

// needsShrink tells whether a stored original is larger than MaxSide or
// is a JPEG still carrying EXIF (written before uploads were processed).
func needsShrink(data []byte, contentType string) bool {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return false
	}
	if max(cfg.Width, cfg.Height) > MaxSide {
		return true
	}
	return contentType == "image/jpeg" && bytes.Contains(data[:min(len(data), 1<<16)], []byte("Exif\x00\x00"))
}
