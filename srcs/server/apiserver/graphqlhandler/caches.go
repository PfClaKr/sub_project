package graphqlhandler

import (
	"time"

	"apiserver/readcache"

	"local.com/dynamo"
)

// Read caches for what lists show (package readcache). Writes below
// Forget the item; the TTLs bound everything else (view counters,
// changes from other services).
var (
	// Authors and sellers: nickname and photo change only through
	// updateProfile (here) or when a member leaves.
	userCache = readcache.New(dynamo.TableUsers, "UserId", "UserId, UserNickname, ProfileImage", 30*time.Minute, 20000)
	// Whole items: a projection would not lower the read units, and
	// GraphQL only returns the fields asked for.
	postCache    = readcache.New(dynamo.TablePosts, "PostId", "", 5*time.Minute, 20000)
	productCache = readcache.New(dynamo.TableProduct, "ProductId", "", 5*time.Minute, 20000)
)

// ForgetUser drops a member's cached nickname and photo (profile change,
// account deletion).
func ForgetUser(userId string) { userCache.Forget(userId) }
