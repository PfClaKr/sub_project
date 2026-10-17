package graphqlhandler

import (
	"local.com/jwt"
	"local.com/notify"

	"github.com/graphql-go/graphql"
)

// Notifications go through a Notifier built on the package's svc, so
// tests that swap svc also cover them.
func notifier() *notify.Notifier { return notify.New(svc) }

func notificationMap(n notify.Notification) map[string]interface{} {
	return map[string]interface{}{
		"SortKey":    n.SortKey,
		"Type":       n.Type,
		"ActorId":    n.ActorId,
		"TargetType": n.TargetType,
		"TargetId":   n.TargetId,
		"Preview":    n.Preview,
		"Link":       n.Link,
		"Read":       n.Read,
		"CreatedAt":  float64(n.CreatedAt),
	}
}

func resolveNotifications(p graphql.ResolveParams) (interface{}, error) {
	userId := jwt.UserID(p.Context)
	if userId == "" {
		return nil, errLogin
	}
	before, _ := p.Args["Before"].(string)
	items, next, err := notifier().List(userId, before)
	if err != nil {
		return nil, internal(err)
	}
	out := make([]map[string]interface{}, 0, len(items))
	for _, n := range items {
		out = append(out, notificationMap(n))
	}
	return map[string]interface{}{"Items": out, "Next": next}, nil
}

// resolveUnreadCount answers 0 for anonymous visitors so the header can
// ask without checking the session first.
func resolveUnreadCount(p graphql.ResolveParams) (interface{}, error) {
	userId := jwt.UserID(p.Context)
	if userId == "" {
		return 0, nil
	}
	count, err := notifier().UnreadCount(userId)
	if err != nil {
		return nil, internal(err)
	}
	return count, nil
}

// markNotificationsReadResolver marks the given notifications read, or
// all of them when SortKeys is empty. Reading is not a write on anyone
// else's behalf, so suspended members may do it.
func markNotificationsReadResolver(p graphql.ResolveParams) (interface{}, error) {
	userId := jwt.UserID(p.Context)
	if userId == "" {
		return nil, errLogin
	}
	var keys []string
	if raw, ok := p.Args["SortKeys"].([]interface{}); ok {
		for _, k := range raw {
			if s, ok := k.(string); ok && s != "" {
				keys = append(keys, s)
			}
		}
	}
	if len(keys) > notify.PageSize {
		keys = keys[:notify.PageSize]
	}
	changed, err := notifier().MarkRead(userId, keys)
	if err != nil {
		return nil, internal(err)
	}
	return changed, nil
}

func settingsView(enabled, hasEmail bool, rows []notify.Setting) map[string]interface{} {
	items := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		items = append(items, map[string]interface{}{"Type": r.Type, "Label": notify.SettingLabels[r.Type], "Email": r.Email, "Push": r.Push})
	}
	return map[string]interface{}{"EmailEnabled": enabled, "HasEmail": hasEmail, "Items": items}
}

func resolveNotifySettings(p graphql.ResolveParams) (interface{}, error) {
	userId := jwt.UserID(p.Context)
	if userId == "" {
		return nil, errLogin
	}
	enabled, hasEmail, rows, err := notify.Settings(svc, userId)
	if err != nil {
		return nil, internal(err)
	}
	return settingsView(enabled, hasEmail, rows), nil
}

// updateNotifySettingsResolver saves the settings screen. Allowed while
// suspended: it only concerns the member's own inbox.
func updateNotifySettingsResolver(p graphql.ResolveParams) (interface{}, error) {
	userId := jwt.UserID(p.Context)
	if userId == "" {
		return nil, errLogin
	}
	var enabled *bool
	if v, ok := p.Args["EmailEnabled"].(bool); ok {
		enabled = &v
	}
	var rows []notify.Setting
	if list, ok := p.Args["Items"].([]interface{}); ok {
		for _, raw := range list {
			m, _ := raw.(map[string]interface{})
			typ, _ := m["Type"].(string)
			email, _ := m["Email"].(string)
			push, _ := m["Push"].(bool)
			rows = append(rows, notify.Setting{Type: typ, Email: email, Push: push})
		}
	}
	if err := notify.SaveSettings(svc, userId, enabled, rows); err != nil {
		return nil, internal(err)
	}
	return resolveNotifySettings(p)
}
