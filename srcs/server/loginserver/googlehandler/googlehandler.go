package googlehandler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/google/uuid"
)

const (
	authEndpoint     = "https://accounts.google.com/o/oauth2/v2/auth"
	tokenEndpoint    = "https://oauth2.googleapis.com/token"
	userinfoEndpoint = "https://www.googleapis.com/oauth2/v2/userinfo"
)

var svc dynamodbiface.DynamoDBAPI

func init() {
	sess := session.Must(session.NewSession(&aws.Config{
		Region:   aws.String(os.Getenv("AWS_REGION")),
		Endpoint: aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
		Credentials: credentials.NewStaticCredentials(
			os.Getenv("AWS_ACCESS_KEY_ID"),
			os.Getenv("AWS_SECRET_ACCESS_KEY"),
			"",
		),
	}))
	svc = dynamodb.New(sess)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Configured reports whether Google OAuth credentials are present.
func Configured() bool {
	return os.Getenv("GOOGLE_CLIENT_ID") != "" && os.Getenv("GOOGLE_CLIENT_SECRET") != ""
}

// StatusHandler lets the frontend know whether to show the Google button.
func StatusHandler(w http.ResponseWriter, r *http.Request) {
	jsonresponse.New(w, http.StatusOK, map[string]bool{"enabled": Configured()})
}

func randomState() string {
	buf := make([]byte, 16)
	rand.Read(buf)
	return hex.EncodeToString(buf)
}

// LoginHandler redirects the browser to Google's consent screen.
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if !Configured() {
		jsonresponse.New(w, http.StatusNotImplemented, map[string]string{"error": "google login is not configured"})
		return
	}

	state := randomState()
	// State is echoed back by Google and compared in the callback.
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		Expires:  time.Now().Add(10 * time.Minute),
		HttpOnly: true,
	})

	params := url.Values{}
	params.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	params.Set("redirect_uri", env("GOOGLE_REDIRECT_URL", "http://localhost:7070/auth/google/callback"))
	params.Set("response_type", "code")
	params.Set("scope", "openid email profile")
	params.Set("state", state)

	http.Redirect(w, r, authEndpoint+"?"+params.Encode(), http.StatusFound)
}

type googleUser struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func exchangeCode(code string) (string, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	form.Set("client_secret", os.Getenv("GOOGLE_CLIENT_SECRET"))
	form.Set("redirect_uri", env("GOOGLE_REDIRECT_URL", "http://localhost:7070/auth/google/callback"))
	form.Set("grant_type", "authorization_code")

	res, err := http.PostForm(tokenEndpoint, form)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("token exchange failed: %s", string(body))
	}

	var payload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return "", err
	}
	return payload.AccessToken, nil
}

func fetchUser(accessToken string) (*googleUser, error) {
	req, err := http.NewRequest(http.MethodGet, userinfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo request failed")
	}

	var user googleUser
	if err := json.NewDecoder(res.Body).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

// findOrCreateUser returns the UserId for a Google account, creating
// the profile and credential rows on first sign-in.
func findOrCreateUser(user *googleUser) (string, error) {
	existing, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("UsersCredential"),
		Key: map[string]*dynamodb.AttributeValue{
			"Email": {S: aws.String(user.Email)},
		},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil {
		return "", err
	}
	if existing.Item != nil && existing.Item["UserId"] != nil && existing.Item["UserId"].S != nil {
		return *existing.Item["UserId"].S, nil
	}

	userId := uuid.NewString()
	nickname := user.Name
	if nickname == "" {
		nickname = strings.Split(user.Email, "@")[0]
	}
	picture := user.Picture
	if picture == "" {
		picture = "default_profile_image.png"
	}

	if _, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("Users"),
		Item: map[string]*dynamodb.AttributeValue{
			"UserId":            {S: aws.String(userId)},
			"Email":             {S: aws.String(user.Email)},
			"UserNickname":      {S: aws.String(nickname)},
			"Residence":         {S: aws.String("파리")},
			"ProfileImage":      {S: aws.String(picture)},
			"PublishedQuantity": {N: aws.String("0")},
			"CreatedAt":         {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
		},
	}); err != nil {
		return "", err
	}

	// Google verifies the address, so the account starts activated and
	// has no local password.
	if _, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("UsersCredential"),
		Item: map[string]*dynamodb.AttributeValue{
			"Email":         {S: aws.String(user.Email)},
			"UserId":        {S: aws.String(userId)},
			"PasswordHash":  {S: aws.String("")},
			"AuthProvider":  {S: aws.String("google")},
			"EmailVerified": {BOOL: aws.Bool(true)},
		},
	}); err != nil {
		return "", err
	}

	return userId, nil
}

// CallbackHandler completes the OAuth flow and sets the session cookie.
func CallbackHandler(w http.ResponseWriter, r *http.Request) {
	appURL := env("PUBLIC_APP_URL", "http://localhost:3000")

	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value == "" || stateCookie.Value != r.URL.Query().Get("state") {
		http.Redirect(w, r, appURL+"/login?error=oauth_state", http.StatusFound)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, appURL+"/login?error=oauth_code", http.StatusFound)
		return
	}

	accessToken, err := exchangeCode(code)
	if err != nil {
		http.Redirect(w, r, appURL+"/login?error=oauth_token", http.StatusFound)
		return
	}

	user, err := fetchUser(accessToken)
	if err != nil || user.Email == "" {
		http.Redirect(w, r, appURL+"/login?error=oauth_user", http.StatusFound)
		return
	}

	userId, err := findOrCreateUser(user)
	if err != nil {
		http.Redirect(w, r, appURL+"/login?error=oauth_account", http.StatusFound)
		return
	}

	tokenString, err := jwt.New(userId)
	if err != nil {
		http.Redirect(w, r, appURL+"/login?error=oauth_session", http.StatusFound)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Path:     "/",
		Expires:  time.Now().Add(jwt.ExpireDuration()),
		HttpOnly: true,
	})
	http.SetCookie(w, &http.Cookie{
		Name:    "oauth_state",
		Value:   "",
		Path:    "/",
		Expires: time.Unix(0, 0),
		MaxAge:  -1,
	})

	http.Redirect(w, r, appURL+"/", http.StatusFound)
}
