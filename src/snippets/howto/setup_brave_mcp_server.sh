# https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
curl -s --compressed "https://api.search.brave.com/res/v1/web/search?q=greek+restaurants+in+san+francisco" \
  -H "Accept: application/json" \
  -H "Accept-Encoding: gzip" \
  -H "X-Subscription-Token: BSAOZdRjze1-gozOpVoTbsoOyh3lqzw" | jq '.'a