package notify

import (
	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// Types lists every event type in settings order.
var Types = []string{TypeComment, TypeReply, TypeAccepted, TypeExpiring, TypeChat, TypeHidden, TypeRestored, TypeNotice}

// DefaultPush: web push for everything a member acts on.
var DefaultPush = map[string]bool{
	TypeComment: true, TypeReply: true, TypeAccepted: true, TypeExpiring: true,
	TypeHidden: true, TypeRestored: true, TypeChat: true, TypeNotice: false,
}

// Prefs are a member's notification settings, stored as the NotifyPrefs
// map on their Users row. Missing entries fall back to the defaults.
type Prefs struct {
	EmailEnabled bool // master switch; one-click unsubscribe turns it off
	Email        map[string]string
	Push         map[string]bool
}

// PrefsOf reads the settings from a Users item.
func PrefsOf(user dynamo.Item) Prefs {
	p := Prefs{EmailEnabled: true, Email: map[string]string{}, Push: map[string]bool{}}
	v := user["NotifyPrefs"]
	if v == nil || v.M == nil {
		return p
	}
	if e := v.M["EmailEnabled"]; e != nil && e.BOOL != nil {
		p.EmailEnabled = *e.BOOL
	}
	if m := v.M["Email"]; m != nil {
		for k, mode := range m.M {
			if mode.S != nil {
				p.Email[k] = *mode.S
			}
		}
	}
	if m := v.M["Push"]; m != nil {
		for k, on := range m.M {
			if on.BOOL != nil {
				p.Push[k] = *on.BOOL
			}
		}
	}
	return p
}

// EmailMode is how this member gets mail for an event type.
func (p Prefs) EmailMode(typ string) string {
	if !p.EmailEnabled {
		return EmailOff
	}
	if mode, ok := p.Email[typ]; ok && validMode(mode) {
		return mode
	}
	if mode := DefaultEmail[typ]; mode != "" {
		return mode
	}
	return EmailOff
}

// PushOn reports whether this member wants web push for an event type.
func (p Prefs) PushOn(typ string) bool {
	if on, ok := p.Push[typ]; ok {
		return on
	}
	return DefaultPush[typ]
}

func validMode(mode string) bool {
	return mode == EmailImmediate || mode == EmailDigest || mode == EmailOff
}

func (p Prefs) item() *dynamodb.AttributeValue {
	email := dynamo.Item{}
	for k, v := range p.Email {
		email[k] = &dynamodb.AttributeValue{S: aws.String(v)}
	}
	push := dynamo.Item{}
	for k, v := range p.Push {
		push[k] = &dynamodb.AttributeValue{BOOL: aws.Bool(v)}
	}
	return &dynamodb.AttributeValue{M: dynamo.Item{
		"EmailEnabled": {BOOL: aws.Bool(p.EmailEnabled)},
		"Email":        {M: email},
		"Push":         {M: push},
	}}
}

// Setting is one row of the settings screen.
type Setting struct {
	Type  string
	Email string
	Push  bool
}

func getUser(svc dynamodbiface.DynamoDBAPI, userId string) (dynamo.Item, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression: aws.String("UserId, Email, UserNickname, NotifyPrefs, Locale"),
	})
	if err != nil {
		return nil, err
	}
	return out.Item, nil
}

// Settings returns the effective settings of a member and whether they
// have an email address at all (Google-only accounts always do).
func Settings(svc dynamodbiface.DynamoDBAPI, userId string) (enabled bool, hasEmail bool, rows []Setting, err error) {
	user, err := getUser(svc, userId)
	if err != nil {
		return false, false, nil, err
	}
	p := PrefsOf(user)
	for _, t := range Types {
		mode := DefaultEmail[t]
		if m, ok := p.Email[t]; ok && validMode(m) {
			mode = m
		}
		rows = append(rows, Setting{Type: t, Email: mode, Push: p.PushOn(t)})
	}
	return p.EmailEnabled, dynamo.S(user, "Email") != "", rows, nil
}

// SaveSettings stores new settings; unknown types and modes are ignored.
// enabled nil keeps the master switch as it is.
func SaveSettings(svc dynamodbiface.DynamoDBAPI, userId string, enabled *bool, rows []Setting) error {
	user, err := getUser(svc, userId)
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}
	p := PrefsOf(user)
	if enabled != nil {
		p.EmailEnabled = *enabled
	}
	for _, r := range rows {
		if _, known := DefaultEmail[r.Type]; !known {
			continue
		}
		if validMode(r.Email) {
			p.Email[r.Type] = r.Email
		}
		p.Push[r.Type] = r.Push
	}
	_, err = svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableUsers),
		Key:                       dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:          aws.String("SET NotifyPrefs = :p"),
		ConditionExpression:       aws.String("attribute_exists(UserId)"),
		ExpressionAttributeValues: dynamo.Item{":p": p.item()},
	})
	return err
}

// UnsubscribeToken signs a member id for the email unsubscribe links.
func UnsubscribeToken(userId string) string { return signer("unsubscribe:" + userId) }

// Unsubscribe turns off all email for a member after checking the token.
func Unsubscribe(svc dynamodbiface.DynamoDBAPI, userId, token string) bool {
	if userId == "" || !verifier("unsubscribe:"+userId, token) {
		return false
	}
	off := false
	return SaveSettings(svc, userId, &off, nil) == nil
}
