#!/bin/bash

curl -X PUT "http://localhost:9200/nori_sample" -H 'Content-Type: application/json' -d'
{
  "settings": {
    "index": {
      "analysis": {
        "tokenizer": {
          "my_nori_tokenizer": {
            "type": "nori_tokenizer",
            "decompound_mode": "mixed",
            "discard_punctuation": "false"
          },
          "my_ngram_tokenizer": {
            "type": "ngram",
            "min_gram": 2,
            "max_gram": 3
          }
        },
        "filter": {
          "stopwords": {
            "type": "stop",
            "stopwords": " "
          }
        },
        "analyzer": {
          "my_nori_analyzer": {
            "type": "custom",
            "tokenizer": "my_nori_tokenizer",
            "filter": ["lowercase", "stop", "trim", "stopwords", "nori_part_of_speech"],
            "char_filter": ["html_strip"]
          },
          "my_ngram_analyzer": {
            "type": "custom",
            "tokenizer": "my_ngram_tokenizer",
            "filter": ["lowercase", "stop", "trim", "stopwords", "nori_part_of_speech"],
            "char_filter": ["html_strip"]
          }
        }
      }
    }
  },
  "mappings" : {
    "properties" : {
      "ProductName": {
        "type" : "text",
        "analyzer": "standard",
        "search_analyzer": "standard",
        "fields": {
          "nori": { 
            "type": "text",
            "analyzer": "my_nori_analyzer",
            "search_analyzer": "my_nori_analyzer"
          },
          "ngram": { 
            "type": "text", 
            "analyzer": "my_ngram_analyzer",
            "search_analyzer": "my_ngram_analyzer"
          }
        }
      }
    }
  }
}
'