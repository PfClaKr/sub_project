package geohandler

import (
	"encoding/json"
	"math"
	"testing"
)

func TestCentroidSquare(t *testing.T) {
	sq := json.RawMessage(`{"type":"Polygon","coordinates":[[[2,48],[3,48],[3,49],[2,49],[2,48]]]}`)
	lat, lng, err := Centroid(sq)
	if err != nil || math.Abs(lat-48.5) > 1e-9 || math.Abs(lng-2.5) > 1e-9 {
		t.Errorf("Centroid = %v,%v,%v; want 48.5,2.5", lat, lng, err)
	}
}

// An L-shaped polygon's centroid is not the vertex average.
func TestCentroidWeighted(t *testing.T) {
	l := json.RawMessage(`{"type":"Polygon","coordinates":[[[0,0],[2,0],[2,1],[1,1],[1,2],[0,2],[0,0]]]}`)
	lat, lng, _ := Centroid(l)
	want := 5.0 / 6
	if math.Abs(lat-want) > 1e-9 || math.Abs(lng-want) > 1e-9 {
		t.Errorf("Centroid = %v,%v; want %v,%v", lat, lng, want, want)
	}
}

func TestCentroidMultiPolygonUsesLargestPart(t *testing.T) {
	mp := json.RawMessage(`{"type":"MultiPolygon","coordinates":[
		[[[0,0],[0.1,0],[0.1,0.1],[0,0.1],[0,0]]],
		[[[10,10],[12,10],[12,12],[10,12],[10,10]]]]}`)
	lat, lng, err := Centroid(mp)
	if err != nil || lat != 11 || lng != 11 {
		t.Errorf("Centroid = %v,%v,%v; want 11,11", lat, lng, err)
	}
}

func TestAreaName(t *testing.T) {
	cases := []struct {
		name, postcode, want, wantPC string
	}{
		{"Paris 15e Arrondissement", "75015", "Paris 15e", "75015"},
		{"Paris 1er Arrondissement", "75001", "Paris 1er", "75001"},
		// OSM has no postcode for the 16e (75016 and 75116).
		{"Paris 16e Arrondissement", "", "Paris 16e", "75016"},
		{"Boulogne-Billancourt", "92100", "Boulogne-Billancourt", "92100"},
		{"Paris", "", "Paris", ""},
	}
	for _, c := range cases {
		p := place{Name: c.name, Address: address{Postcode: c.postcode}}
		if got, pc := areaName(p); got != c.want || pc != c.wantPC {
			t.Errorf("areaName(%q, %q) = %q, %q; want %q, %q", c.name, c.postcode, got, pc, c.want, c.wantPC)
		}
	}
	a := Area{Name: "Paris 15e", Postcode: "75015"}
	if a.Label() != "Paris 15e (75015)" {
		t.Errorf("Label = %q", a.Label())
	}
}
