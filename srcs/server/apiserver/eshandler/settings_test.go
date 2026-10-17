package eshandler

import (
	"encoding/json"
	"testing"
)

// The settings are assembled from string pieces; make sure each one is
// valid JSON and keeps the analyzers the queries rely on.
func TestIndexSettingsAreValidJSON(t *testing.T) {
	for name, settings := range map[string]string{"products": indexSettings, "posts": postIndexSettings} {
		var parsed struct {
			Settings struct {
				Index struct {
					Analysis struct {
						Analyzer map[string]interface{} `json:"analyzer"`
					} `json:"analysis"`
				} `json:"index"`
			} `json:"settings"`
			Mappings struct {
				Properties map[string]interface{} `json:"properties"`
			} `json:"mappings"`
		}
		if err := json.Unmarshal([]byte(settings), &parsed); err != nil {
			t.Fatalf("%s settings: %v", name, err)
		}
		for _, a := range []string{"ko_index", "ko_search", "compact", "words", "words_prefix"} {
			if parsed.Settings.Index.Analysis.Analyzer[a] == nil {
				t.Errorf("%s settings lack analyzer %s", name, a)
			}
		}
		if len(parsed.Mappings.Properties) == 0 {
			t.Errorf("%s settings have no mappings", name)
		}
	}
}
