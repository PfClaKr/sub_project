package uploadhandler

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"
)

func encode(t *testing.T, img image.Image, kind string) []byte {
	t.Helper()
	var b bytes.Buffer
	var err error
	switch kind {
	case "jpeg":
		err = jpeg.Encode(&b, img, &jpeg.Options{Quality: 95})
	case "png":
		err = png.Encode(&b, img)
	case "gif":
		err = gif.Encode(&b, img, nil)
	}
	if err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// photo is w×h with a red left half, so orientation is visible.
func photo(w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := color.RGBA{20, 40, 200, 255}
			if x < w/2 {
				c = color.RGBA{220, 30, 30, 255}
			}
			img.SetRGBA(x, y, c)
		}
	}
	return img
}

// withOrientation inserts an EXIF APP1 segment (big-endian TIFF, one
// IFD entry: Orientation) after the JPEG's SOI marker.
func withOrientation(data []byte, o uint16) []byte {
	tiff := []byte("MM\x00\x2a\x00\x00\x00\x08")
	entry := make([]byte, 2+12+4)
	binary.BigEndian.PutUint16(entry, 1)
	binary.BigEndian.PutUint16(entry[2:], 0x0112)
	binary.BigEndian.PutUint16(entry[4:], 3) // SHORT
	binary.BigEndian.PutUint32(entry[6:], 1)
	binary.BigEndian.PutUint16(entry[10:], o)
	seg := append([]byte("Exif\x00\x00"), append(tiff, entry...)...)
	app1 := []byte{0xFF, 0xE1, 0, 0}
	binary.BigEndian.PutUint16(app1[2:], uint16(len(seg)+2))
	out := append([]byte{}, data[:2]...)
	out = append(out, app1...)
	out = append(out, seg...)
	return append(out, data[2:]...)
}

func size(t *testing.T, data []byte) (int, int) {
	t.Helper()
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	return cfg.Width, cfg.Height
}

func TestProcessShrinksAndMakesThumbnails(t *testing.T) {
	out, err := process(encode(t, photo(3000, 2000), "jpeg"), "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	if w, h := size(t, out.data); w != MaxSide || h != 1066 {
		t.Errorf("stored %dx%d, want %dx1066", w, h, MaxSide)
	}
	if w, h := size(t, out.thumb); w != ThumbSide || h != 426 {
		t.Errorf("thumbnail %dx%d, want %dx426", w, h, ThumbSide)
	}
	if out.ext != ".jpg" || out.thumbExt != "_t.jpg" || out.thumbType != "image/jpeg" {
		t.Errorf("names = %q %q %q", out.ext, out.thumbExt, out.thumbType)
	}

	small, _ := process(encode(t, photo(400, 300), "jpeg"), "image/jpeg")
	if w, h := size(t, small.data); w != 400 || h != 300 {
		t.Errorf("a small photo was resized to %dx%d", w, h)
	}
}

func TestProcessAppliesOrientationAndDropsExif(t *testing.T) {
	raw := withOrientation(encode(t, photo(1200, 800), "jpeg"), 6)
	if jpegOrientation(raw) != 6 {
		t.Fatalf("orientation = %d, want 6", jpegOrientation(raw))
	}
	out, err := process(raw, "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	if w, h := size(t, out.data); w != 800 || h != 1200 {
		t.Errorf("rotated photo is %dx%d, want 800x1200", w, h)
	}
	if jpegOrientation(out.data) != 1 || bytes.Contains(out.data, []byte("Exif")) {
		t.Error("EXIF must not survive re-encoding")
	}
	// Orientation 6 = turn clockwise: the red left half ends up on top.
	img, _ := jpeg.Decode(bytes.NewReader(out.data))
	if r, _, b, _ := img.At(400, 100).RGBA(); r>>8 < 150 || b>>8 > 100 {
		t.Error("top of the rotated photo is not red")
	}
}

func TestProcessKeepsTransparencyAndGif(t *testing.T) {
	clear := image.NewNRGBA(image.Rect(0, 0, 2000, 1000))
	out, err := process(encode(t, clear, "png"), "image/png")
	if err != nil {
		t.Fatal(err)
	}
	if out.ext != ".png" || out.thumbExt != "_t.png" {
		t.Errorf("png names = %q %q", out.ext, out.thumbExt)
	}
	thumb, _ := png.Decode(bytes.NewReader(out.thumb))
	if _, _, _, a := thumb.At(10, 10).RGBA(); a != 0 {
		t.Error("the PNG thumbnail lost its transparency")
	}

	pal := image.NewPaletted(image.Rect(0, 0, 50, 50), []color.Color{color.Black, color.White})
	raw := encode(t, pal, "gif")
	g, err := process(raw, "image/gif")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(g.data, raw) || g.thumbExt != "_t.png" {
		t.Error("a GIF must be stored as uploaded, with a PNG thumbnail")
	}
}

func TestProcessRefusesDecompressionBombs(t *testing.T) {
	// A tiny PNG whose header claims 20000×20000 pixels.
	var b bytes.Buffer
	png.Encode(&b, image.NewGray(image.Rect(0, 0, 1, 1)))
	raw := b.Bytes()
	binary.BigEndian.PutUint32(raw[16:], 20000)
	binary.BigEndian.PutUint32(raw[20:], 20000)
	if _, err := process(raw, "image/png"); err == nil {
		t.Error("a 400 MP image was accepted")
	}
}

func TestThumbKey(t *testing.T) {
	for in, want := range map[string]string{"a.jpg": "a_t.jpg", "a.webp": "a_t.jpg", "a.png": "a_t.png", "a.gif": "a_t.png", "a_t.jpg": "", "noext": ""} {
		if got := thumbKey(in); got != want {
			t.Errorf("thumbKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNeedsShrink(t *testing.T) {
	big := encode(t, photo(2000, 1000), "jpeg")
	withExif := withOrientation(encode(t, photo(400, 300), "jpeg"), 1)
	done, _ := process(big, "image/jpeg")
	if !needsShrink(big, "image/jpeg") || !needsShrink(withExif, "image/jpeg") {
		t.Error("big or EXIF-carrying originals must be shrunk")
	}
	if needsShrink(done.data, "image/jpeg") {
		t.Error("a processed photo must not be re-encoded again")
	}
}
