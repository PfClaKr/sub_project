package main

import(
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    "strings"

    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/service/dynamodb"
    "github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

func getUserByEmail(email string) (string, string, error) {
    result, err := svc.Query(&dynamodb.QueryInput{
        TableName: aws.String("Users"),
        IndexName: aws.String("UserEmailIndex"),
        KeyConditions: map[string]*dynamodb.Condition{
            "Email": {
                ComparisonOperator: aws.String("EQ"),
                AttributeValueList: []*dynamodb.AttributeValue{
                    {
                        S: aws.String(email),
                    },
                },
            },
        },
        ProjectionExpression: aws.String("PasswordHash, UserId"),
    })
    if err != nil {
        return "","", err
    }

    if len(result.Items) == 0 {
        return "", "", fmt.Errorf("user not found")
    }

    var user struct {
        UserId string `json:"UserId"`
        PasswordHash string `json:"PasswordHash"`
    }
    err = dynamodbattribute.UnmarshalMap(result.Items[0], &user)
    if err != nil {
        return "", "", err
    }

    return user.UserId, user.PasswordHash, nil
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    var loginRequest struct {
        Email    string `json:"email"`
        PasswordHash string `json:"password"`
    }

    if err := json.NewDecoder(r.Body).Decode(&loginRequest); err != nil {
		w.WriteHeader(http.StatusBadRequest)
        json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request payload"})
        return
    }

    userId, passwordHash, err := getUserByEmail(loginRequest.Email)
    if err != nil {
	    w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("Invalid email or password: %s", err)})
        return
    }

    if strings.Compare(passwordHash, loginRequest.PasswordHash) != 0 {
		w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{"error": "Invalid email or password"})
        return
    }

    tokenString, err := generateJWT(userId)
    if err != nil {
        w.WriteHeader(http.StatusInternalServerError)
        json.NewEncoder(w).Encode(map[string]string{"error": "Error generating token"})
        return
    }

    http.SetCookie(w, &http.Cookie{
        Name:     "token",
        Value:    tokenString,
        Expires:  time.Now().Add(30 * time.Minute),
        HttpOnly: true,
    })

    response := map[string]string{
        "message": "JWT created",
    }

    w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
    json.NewEncoder(w).Encode(response)
}