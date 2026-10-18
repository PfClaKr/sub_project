package mailer

import (
	"bytes"
	_ "embed"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"strconv"
	"sync"
)

// logo.png is the app icon (srcs/mobile/assets/icon-only.png) at 96 px,
// three times its size in the mail, with the rounded corners baked into
// the alpha channel since mail clients ignore border-radius on images.
// It is the brand blue with a white cat.
//
//go:embed logo.png
var logoPNG []byte

// LogoID is the Content-ID of the logo attached to every HTML mail.
const LogoID = "logo@itnyang"

// iconBlue is the blue the icon is drawn in (DefaultTheme.Primary).
var iconBlue = [3]float64{0, 72, 180}

var logos sync.Map // primary colour → PNG bytes

// Logo returns the icon with its blue replaced by primary (#rrggbb).
// Each pixel is read as a mix of white and a shade of the icon blue, and
// rebuilt as the same mix of white and that shade of primary, so the
// cat, its outlines and the anti-aliased edges keep their look.
func Logo(primary string) []byte {
	if !hexColor.MatchString(primary) {
		primary = DefaultTheme.Primary
	}
	if b, ok := logos.Load(primary); ok {
		return b.([]byte)
	}
	src, err := png.Decode(bytes.NewReader(logoPNG))
	if err != nil {
		return logoPNG
	}
	target := hexRGB(primary)
	bounds := src.Bounds()
	out := image.NewNRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := color.NRGBAModel.Convert(src.At(x, y)).(color.NRGBA)
			// White share: the icon blue has no red, so red is white.
			w := float64(c.R) / 255
			// Shade of the blue part per channel (outlines are darker),
			// so the default colour gives back the icon unchanged; red,
			// absent from the icon blue, takes the average shade.
			shade := [3]float64{1, 1, 1}
			if w < 0.98 {
				for i := 1; i < 3; i++ {
					ch := float64([3]uint8{c.R, c.G, c.B}[i])
					shade[i] = clamp((ch-255*w)/(1-w)/iconBlue[i], 0, 1.4)
				}
				shade[0] = (shade[1] + shade[2]) / 2
			}
			px := [3]float64{}
			for i := range px {
				px[i] = 255*w + (1-w)*clamp(target[i]*shade[i], 0, 255)
			}
			out.SetNRGBA(x, y, color.NRGBA{R: uint8(px[0] + 0.5), G: uint8(px[1] + 0.5), B: uint8(px[2] + 0.5), A: c.A})
		}
	}
	var b bytes.Buffer
	if err := png.Encode(&b, out); err != nil {
		return logoPNG
	}
	logos.Store(primary, b.Bytes())
	return b.Bytes()
}

// LogoDataURI is the logo inline, for previews that cannot resolve cid:.
func LogoDataURI(primary string) string {
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(Logo(primary))
}

func hexRGB(hex string) [3]float64 {
	var out [3]float64
	for i := range out {
		v, _ := strconv.ParseUint(hex[1+2*i:3+2*i], 16, 8)
		out[i] = float64(v)
	}
	return out
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
