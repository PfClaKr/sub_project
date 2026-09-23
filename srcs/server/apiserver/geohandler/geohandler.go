// Package geohandler resolves map points to administrative areas (a
// Paris arrondissement, or a commune elsewhere) with their boundary, the
// way leboncoin shows an ad's town instead of an address.
//
// All OpenStreetMap Nominatim traffic goes through here: it is throttled
// to Nominatim's 1 request/second policy, sent with a User-Agent, and
// areas are cached in memory and in the GeoAreas table.
package geohandler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"local.com/dynamo"
	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

const TableGeoAreas = "GeoAreas"

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

var nominatimURL = envOr("NOMINATIM_URL", "https://nominatim.openstreetmap.org")

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

var ErrNoArea = errors.New("no administrative area at this point")

// Area is a town or arrondissement with its (simplified) boundary.
type Area struct {
	AreaId    string          `json:"AreaId"` // OSM relation, e.g. "R9520"
	Name      string          `json:"Name"`   // "Paris 15e", "Boulogne-Billancourt"
	Postcode  string          `json:"Postcode"`
	CenterLat float64         `json:"CenterLat"`
	CenterLng float64         `json:"CenterLng"`
	Geometry  json.RawMessage `json:"Geometry"` // GeoJSON Polygon / MultiPolygon
}

// Label is the text shown for an area, e.g. "Paris 15e (75015)".
func (a *Area) Label() string {
	if a.Postcode == "" {
		return a.Name
	}
	return fmt.Sprintf("%s (%s)", a.Name, a.Postcode)
}

// ---- Nominatim client ----

var (
	client   = &http.Client{Timeout: 10 * time.Second}
	throttle sync.Mutex
	lastCall time.Time
)

func nominatim(path string, q url.Values, out interface{}) error {
	throttle.Lock()
	if wait := time.Until(lastCall.Add(1100 * time.Millisecond)); wait > 0 {
		time.Sleep(wait)
	}
	lastCall = time.Now()
	throttle.Unlock()

	q.Set("format", "jsonv2")
	req, _ := http.NewRequest("GET", nominatimURL+path+"?"+q.Encode(), nil)
	req.Header.Set("User-Agent", "itnyang/1.0 (Paris Korean second-hand market)")
	req.Header.Set("Accept-Language", "fr,ko")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("nominatim %s: %s", path, res.Status)
	}
	return json.NewDecoder(res.Body).Decode(out)
}

type address struct {
	HouseNumber string `json:"house_number"`
	Road        string `json:"road"`
	Pedestrian  string `json:"pedestrian"`
	Suburb      string `json:"suburb"`
	City        string `json:"city"`
	Town        string `json:"town"`
	Village     string `json:"village"`
	Postcode    string `json:"postcode"`
}

type place struct {
	OsmType     string          `json:"osm_type"`
	OsmId       int64           `json:"osm_id"`
	Type        string          `json:"type"`
	Name        string          `json:"name"`
	DisplayName string          `json:"display_name"`
	Lat         string          `json:"lat"`
	Lon         string          `json:"lon"`
	Address     address         `json:"address"`
	GeoJSON     json.RawMessage `json:"geojson"`
}

var arrondissement = regexp.MustCompile(`^Paris (\d{1,2})(?:e|er) Arrondissement$`)

// areaName shortens "Paris 15e Arrondissement" to "Paris 15e" and fills
// a missing postcode (OSM leaves it empty for the 16e, which has two).
func areaName(p place) (name, postcode string) {
	postcode = p.Address.Postcode
	m := arrondissement.FindStringSubmatch(p.Name)
	if m == nil {
		return p.Name, postcode
	}
	n, _ := strconv.Atoi(m[1])
	if postcode == "" {
		postcode = fmt.Sprintf("750%02d", n)
	}
	if n == 1 {
		return "Paris 1er", postcode
	}
	return fmt.Sprintf("Paris %de", n), postcode
}

// areaVersion invalidates stored areas when naming rules change; stale
// rows are fetched again from OpenStreetMap by id.
const areaVersion = "2"

// ---- cache ----

var (
	mu        sync.Mutex
	areas     = map[string]*Area{}
	pointArea = map[string]string{} // rounded "lat,lng" → AreaId
)

func pointKey(lat, lng float64) string {
	return fmt.Sprintf("%.4f,%.4f", lat, lng) // ~10 m
}

var areaIdPattern = regexp.MustCompile(`^R\d+$`)

// GetArea returns an area from memory, the GeoAreas table, or finally
// OpenStreetMap; nil when the id is unknown.
func GetArea(id string) (*Area, error) {
	if !areaIdPattern.MatchString(id) {
		return nil, nil
	}
	mu.Lock()
	a := areas[id]
	mu.Unlock()
	if a != nil {
		return a, nil
	}
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(TableGeoAreas),
		Key:       dynamo.Item{"AreaId": {S: aws.String(id)}},
	})
	if err != nil {
		return nil, err
	}
	if out.Item == nil || dynamo.S(out.Item, "Version") != areaVersion {
		return lookupArea(id)
	}
	a = &Area{
		AreaId:   id,
		Name:     dynamo.S(out.Item, "Name"),
		Postcode: dynamo.S(out.Item, "Postcode"),
		Geometry: json.RawMessage(dynamo.S(out.Item, "Geometry")),
	}
	a.CenterLat, _ = strconv.ParseFloat(aws.StringValue(out.Item["CenterLat"].N), 64)
	a.CenterLng, _ = strconv.ParseFloat(aws.StringValue(out.Item["CenterLng"].N), 64)
	mu.Lock()
	areas[id] = a
	mu.Unlock()
	return a, nil
}

func storeArea(a *Area) {
	mu.Lock()
	areas[a.AreaId] = a
	mu.Unlock()
	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(TableGeoAreas),
		Item: dynamo.Item{
			"AreaId":    {S: aws.String(a.AreaId)},
			"Version":   {S: aws.String(areaVersion)},
			"Name":      {S: aws.String(a.Name)},
			"Postcode":  {S: aws.String(a.Postcode)},
			"CenterLat": {N: aws.String(strconv.FormatFloat(a.CenterLat, 'f', 6, 64))},
			"CenterLng": {N: aws.String(strconv.FormatFloat(a.CenterLng, 'f', 6, 64))},
			"Geometry":  {S: aws.String(string(a.Geometry))},
		},
	})
	if err != nil {
		log.Printf("geo: store area %s: %v", a.AreaId, err)
	}
}

// fromPlace builds an Area from a Nominatim result with a boundary.
func fromPlace(p place) (*Area, error) {
	var geom struct{ Type string }
	json.Unmarshal(p.GeoJSON, &geom)
	if p.OsmType != "relation" || p.Type != "administrative" || (geom.Type != "Polygon" && geom.Type != "MultiPolygon") {
		return nil, ErrNoArea
	}
	a := &Area{AreaId: fmt.Sprintf("R%d", p.OsmId), Geometry: p.GeoJSON}
	a.Name, a.Postcode = areaName(p)
	var err error
	a.CenterLat, a.CenterLng, err = Centroid(p.GeoJSON)
	if err != nil {
		return nil, err
	}
	storeArea(a)
	return a, nil
}

func lookupArea(id string) (*Area, error) {
	var found []place
	if err := nominatim("/lookup", url.Values{
		"osm_ids": {id}, "addressdetails": {"1"}, "polygon_geojson": {"1"}, "polygon_threshold": {"0.0003"},
	}, &found); err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, nil
	}
	a, err := fromPlace(found[0])
	if errors.Is(err, ErrNoArea) {
		return nil, nil
	}
	return a, err
}

// Resolve returns the arrondissement / commune containing a point.
func Resolve(lat, lng float64) (*Area, error) {
	key := pointKey(lat, lng)
	mu.Lock()
	id := pointArea[key]
	mu.Unlock()
	if id != "" {
		if a, err := GetArea(id); err == nil && a != nil {
			return a, nil
		}
	}

	// zoom 12 = arrondissements inside Paris, communes elsewhere.
	var p place
	err := nominatim("/reverse", url.Values{
		"lat": {strconv.FormatFloat(lat, 'f', 6, 64)}, "lon": {strconv.FormatFloat(lng, 'f', 6, 64)},
		"zoom": {"12"}, "addressdetails": {"1"}, "polygon_geojson": {"1"}, "polygon_threshold": {"0.0003"},
	}, &p)
	if err != nil {
		return nil, err
	}
	a, err := fromPlace(p)
	if err != nil {
		return nil, err
	}
	mu.Lock()
	if len(pointArea) > 20000 {
		pointArea = map[string]string{}
	}
	pointArea[key] = a.AreaId
	mu.Unlock()
	return a, nil
}

// StreetLabel returns "12 Rue X" for an exact pin, or "" if unknown.
func StreetLabel(lat, lng float64) string {
	var p place
	if err := nominatim("/reverse", url.Values{
		"lat": {strconv.FormatFloat(lat, 'f', 6, 64)}, "lon": {strconv.FormatFloat(lng, 'f', 6, 64)},
		"zoom": {"18"}, "addressdetails": {"1"},
	}, &p); err != nil {
		return ""
	}
	road := p.Address.Road
	if road == "" {
		road = p.Address.Pedestrian
	}
	return strings.TrimSpace(p.Address.HouseNumber + " " + road)
}

// ---- geometry ----

// Centroid is the area-weighted centre of a Polygon, or of the largest
// part of a MultiPolygon (GeoJSON order: [lng, lat]).
func Centroid(geojson json.RawMessage) (lat, lng float64, err error) {
	var g struct {
		Type        string
		Coordinates json.RawMessage
	}
	if err := json.Unmarshal(geojson, &g); err != nil {
		return 0, 0, err
	}
	var polys [][][][2]float64
	switch g.Type {
	case "Polygon":
		var p [][][2]float64
		if err := json.Unmarshal(g.Coordinates, &p); err != nil {
			return 0, 0, err
		}
		polys = append(polys, p)
	case "MultiPolygon":
		if err := json.Unmarshal(g.Coordinates, &polys); err != nil {
			return 0, 0, err
		}
	default:
		return 0, 0, fmt.Errorf("unsupported geometry %q", g.Type)
	}

	best := -1.0
	for _, poly := range polys {
		if len(poly) == 0 || len(poly[0]) < 3 {
			continue
		}
		ring := poly[0]
		var a, cx, cy float64
		for i := range ring {
			x0, y0 := ring[i][0], ring[i][1]
			x1, y1 := ring[(i+1)%len(ring)][0], ring[(i+1)%len(ring)][1]
			cross := x0*y1 - x1*y0
			a += cross
			cx += (x0 + x1) * cross
			cy += (y0 + y1) * cross
		}
		if a == 0 {
			continue
		}
		if math.Abs(a) > best {
			best = math.Abs(a)
			lng, lat = cx/(3*a), cy/(3*a)
		}
	}
	if best < 0 {
		return 0, 0, errors.New("empty geometry")
	}
	return lat, lng, nil
}

// ---- HTTP ----

func Register(r *mux.Router) {
	r.HandleFunc("/geo/resolve", resolveHandler).Methods("GET")
	r.HandleFunc("/geo/address", addressHandler).Methods("GET")
	r.HandleFunc("/geo/areas/{id}", areaHandler).Methods("GET")
	r.HandleFunc("/geo/search", searchHandler).Methods("GET")
}

func point(r *http.Request) (float64, float64, bool) {
	lat, err1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, err2 := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	return lat, lng, err1 == nil && err2 == nil && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

func cacheFor(w http.ResponseWriter, d time.Duration) {
	w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(d.Seconds())))
}

func resolveHandler(w http.ResponseWriter, r *http.Request) {
	lat, lng, ok := point(r)
	if !ok {
		jsonresponse.Error(w, http.StatusBadRequest, "위치가 올바르지 않아요.")
		return
	}
	a, err := Resolve(lat, lng)
	if errors.Is(err, ErrNoArea) {
		jsonresponse.Error(w, http.StatusNotFound, "이 위치의 동네를 찾지 못했어요.")
		return
	}
	if err != nil {
		log.Printf("geo resolve: %v", err)
		jsonresponse.Error(w, http.StatusBadGateway, "지도 서비스에 연결하지 못했어요.")
		return
	}
	cacheFor(w, time.Hour)
	jsonresponse.New(w, http.StatusOK, a)
}

func addressHandler(w http.ResponseWriter, r *http.Request) {
	lat, lng, ok := point(r)
	if !ok {
		jsonresponse.Error(w, http.StatusBadRequest, "위치가 올바르지 않아요.")
		return
	}
	cacheFor(w, time.Hour)
	jsonresponse.New(w, http.StatusOK, map[string]string{"Street": StreetLabel(lat, lng)})
}

func areaHandler(w http.ResponseWriter, r *http.Request) {
	a, err := GetArea(mux.Vars(r)["id"])
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if a == nil {
		jsonresponse.Error(w, http.StatusNotFound, "지역을 찾을 수 없어요.")
		return
	}
	cacheFor(w, 24*time.Hour)
	jsonresponse.New(w, http.StatusOK, a)
}

// Place is a search suggestion.
type Place struct {
	Label  string  `json:"Label"`
	Detail string  `json:"Detail"`
	Lat    float64 `json:"Lat"`
	Lng    float64 `json:"Lng"`
}

var (
	searchMu    sync.Mutex
	searchCache = map[string][]Place{}
)

func searchHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len([]rune(q)) < 2 || len([]rune(q)) > 100 {
		jsonresponse.New(w, http.StatusOK, []Place{})
		return
	}
	key := strings.ToLower(q)
	searchMu.Lock()
	cached, hit := searchCache[key]
	searchMu.Unlock()
	if hit {
		cacheFor(w, time.Hour)
		jsonresponse.New(w, http.StatusOK, cached)
		return
	}

	var found []place
	if err := nominatim("/search", url.Values{
		"q": {q}, "addressdetails": {"1"}, "limit": {"6"}, "countrycodes": {"fr"},
		// Prefer Île-de-France without excluding the rest of France.
		"viewbox": {"1.45,49.24,3.56,48.12"},
	}, &found); err != nil {
		log.Printf("geo search: %v", err)
		jsonresponse.Error(w, http.StatusBadGateway, "지도 서비스에 연결하지 못했어요.")
		return
	}
	places := []Place{}
	for _, p := range found {
		lat, _ := strconv.ParseFloat(p.Lat, 64)
		lng, _ := strconv.ParseFloat(p.Lon, 64)
		label := p.Name
		if label == "" {
			label = strings.Split(p.DisplayName, ",")[0]
		}
		places = append(places, Place{Label: label, Detail: p.DisplayName, Lat: lat, Lng: lng})
	}
	searchMu.Lock()
	if len(searchCache) > 2000 {
		searchCache = map[string][]Place{}
	}
	searchCache[key] = places
	searchMu.Unlock()
	cacheFor(w, time.Hour)
	jsonresponse.New(w, http.StatusOK, places)
}
