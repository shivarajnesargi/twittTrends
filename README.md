# twittTrends
This project is aimed at sentimental analysis of the tweets according to the given keyword and pinning the location of the tweets.

The project is designed using NODEJs and Amazon Web Services

The UX interface is designed using HTML5 and bootstrap CSS which allows users to select the keyword from the dropdown. The selected item is then parsed at the server side and the tweets relating to the Keyword are selected. These tweets are checked for the English language and for geo Coordinates. If both of the conditions pass then the tweets are sent to the AMAZON SQS where tweets are pushed into the queue. Then the queue is queried for any new tweets. The tweets are then sent for "Sentimental Analysis" to determine the sentiment of the tweet using Watson's Alchemy API and once the tweets are processed a notification is sent to the configured HTTP endpoint(here it is the URL of the EBS application) and then it is indexed in Amazon's Elastic Search.
