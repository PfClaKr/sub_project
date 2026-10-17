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
