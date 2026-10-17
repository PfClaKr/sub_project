#!/usr/bin/env bash
# One-time AWS setup for the single-host deployment (deploy/README.md).
# Run from your own machine with admin credentials for the AWS CLI:
#
#   BUCKET=itnyang-images-xyz ALERT_EMAIL=you@example.com ./deploy/aws-setup.sh
#
# It creates:
#   - the S3 bucket for product images, publicly readable (objects only)
#   - an IAM user "itnyang-app" limited to the app's tables and bucket
#     (re-run after adding a table: the policy is replaced, keys are kept),
#     and prints its access key for deploy/.env
#   - a monthly cost budget that mails ALERT_EMAIL at 80% and 100%
# DynamoDB tables are created by the apiserver on first start.
# Re-running is safe; an existing access key is not rotated.
set -euo pipefail

REGION=${AWS_REGION:-eu-west-3}
BUCKET=${BUCKET:?set BUCKET, a globally unique bucket name}
USER_NAME=${USER_NAME:-itnyang-app}
BUDGET_USD=${BUDGET_USD:-15}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
TABLES="Users UsersCredential Product Favorites ChatRooms ChatMessage GeoAreas Posts Comments PostLikes Bookmarks Reports Notifications PushSubscriptions"

echo "== S3 bucket $BUCKET ($REGION)"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
	aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
		--create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi
# New buckets block public policies. Keep ACLs blocked, allow the policy.
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
	BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
	\"Version\": \"2012-10-17\",
	\"Statement\": [{
		\"Sid\": \"PublicReadImages\",
		\"Effect\": \"Allow\",
		\"Principal\": \"*\",
		\"Action\": \"s3:GetObject\",
		\"Resource\": \"arn:aws:s3:::$BUCKET/*\"
	}]
}"

echo "== IAM user $USER_NAME"
aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1 ||
	aws iam create-user --user-name "$USER_NAME" >/dev/null

table_arns=""
for t in $TABLES; do
	table_arns+="\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$t\",\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/$t/index/*\","
done
table_arns=${table_arns%,}

aws iam put-user-policy --user-name "$USER_NAME" --policy-name itnyang-app --policy-document "{
	\"Version\": \"2012-10-17\",
	\"Statement\": [
		{
			\"Sid\": \"Tables\",
			\"Effect\": \"Allow\",
			\"Action\": [
				\"dynamodb:CreateTable\", \"dynamodb:DescribeTable\",
				\"dynamodb:DescribeTimeToLive\", \"dynamodb:UpdateTimeToLive\", \"dynamodb:UpdateTable\",
				\"dynamodb:GetItem\", \"dynamodb:BatchGetItem\", \"dynamodb:Query\", \"dynamodb:Scan\",
				\"dynamodb:PutItem\", \"dynamodb:UpdateItem\", \"dynamodb:DeleteItem\",
				\"dynamodb:BatchWriteItem\", \"dynamodb:ConditionCheckItem\"
			],
			\"Resource\": [$table_arns]
		},
		{
			\"Sid\": \"ListTables\",
			\"Effect\": \"Allow\",
			\"Action\": \"dynamodb:ListTables\",
			\"Resource\": \"*\"
		},
		{
			\"Sid\": \"Images\",
			\"Effect\": \"Allow\",
			\"Action\": [\"s3:PutObject\", \"s3:GetObject\", \"s3:DeleteObject\"],
			\"Resource\": \"arn:aws:s3:::$BUCKET/*\"
		},
		{
			\"Sid\": \"Bucket\",
			\"Effect\": \"Allow\",
			\"Action\": \"s3:ListBucket\",
			\"Resource\": \"arn:aws:s3:::$BUCKET\"
		}
	]
}"

if [ "$(aws iam list-access-keys --user-name "$USER_NAME" --query 'length(AccessKeyMetadata)' --output text)" = "0" ]; then
	read -r key secret < <(aws iam create-access-key --user-name "$USER_NAME" \
		--query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
	echo
	echo "Put these in deploy/.env on the server (shown only once):"
	echo "AWS_REGION=$REGION"
	echo "AWS_ACCESS_KEY_ID=$key"
	echo "AWS_SECRET_ACCESS_KEY=$secret"
	echo "S3_BUCKET=$BUCKET"
	echo
else
	echo "$USER_NAME already has an access key; not creating another."
fi

if [ -n "${ALERT_EMAIL:-}" ]; then
	echo "== Budget: \$$BUDGET_USD/month, alerts to $ALERT_EMAIL"
	if aws budgets describe-budget --account-id "$ACCOUNT" --budget-name itnyang-monthly >/dev/null 2>&1; then
		echo "budget itnyang-monthly already exists"
	else
		notify() {
			echo "{\"Notification\":{\"NotificationType\":\"$1\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":$2,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$ALERT_EMAIL\"}]}"
		}
		aws budgets create-budget --account-id "$ACCOUNT" \
			--budget "{\"BudgetName\":\"itnyang-monthly\",\"BudgetLimit\":{\"Amount\":\"$BUDGET_USD\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
			--notifications-with-subscribers "[$(notify ACTUAL 80),$(notify FORECASTED 100)]"
	fi
fi

echo "Done."
