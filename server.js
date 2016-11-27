//Local host port
var PORT = 9090;

var express = require('express');
var app = express();
var cors = require('cors');
var http = require('http');
var server = http.createServer(app).listen(process.env.PORT || PORT); //AWS port is selected by process env PORT
var io = require('socket.io')(server);
var twitter = require('twitter');
var env = require('dotenv').config();
var elasticsearch = require('elasticsearch');
var awsEs = require('http-aws-es');
var fs = require('fs');
var path = require('path');
var globalSocket;
var aws = require('aws-sdk');

// Load your AWS credentials and try to instantiate the object.
aws.config.loadFromPath(__dirname + '/awsConfig.json');
var sns = new aws.SNS();
var AlchemyLanguageV1 = require('watson-developer-cloud/alchemy-language/v1');
var alchemy = new AlchemyLanguageV1({
    api_key: process.env.alchemy_api_key
});
var consumer = require('sqs-consumer');
var queueUrl = "https://sqs.us-east-1.amazonaws.com/566655405146/MyFirstQueue";
var indexEs=1;


//AWS-SNS
server.on('request', function(request, response) {
    request.setEncoding('utf8');

    //concatenate POST data
    var msgBody = '';
    request.on('data', function(data) {
        msgBody += data;
    });
    request.on('end', function() {
        var msgData = JSON.stringify(msgBody);
        var msgType = request.headers['x-amz-sns-message-type'];
        handleIncomingMessage(msgType, msgData);
    });

});

//Method to handle the incoming messages posted by Amazon SNS

function handleIncomingMessage(msgType, msgData) {
    if (msgType === 'SubscriptionConfirmation') {
        //confirm the subscription.
        sns.confirmSubscription({
            TopicArn: msgData.TopicArn
        }, onAwsResponse);
    } else if (msgType === 'Notification') {
        console.log("Notification has arrived");
    } else {
        console.log('Unexpected message type ' + msgType);
    }
}

//Method to publish SNS messages to the http endpoint
function publishToSns(tweet) {
    console.log("Inside publishSNS");
    saveInEs(tweet);
    var payload = {
        default:"New Tweet has arrived",
        msg: "New Tweet has arrived"
    };
    sns.publish({
        Message: JSON.stringify(payload),
        MessageStructure: 'json',
        TopicArn: 'arn:aws:sns:us-east-1:566655405146:TestingSns'
    }, function(err, data) {
        if (err) {
            console.log(err.stack);
            return;
        }
        else
        {  
        console.log("-----------------------SNS Publish-----------------------");  
        console.log(data);
        console.log("-----------------------SNS Publish-----------------------");
        }
    });
}

// Used to subscribe to a topic
app.get('/subscribe', function(req, res) {

    sns.subscribe({
        Protocol: 'http',
        //You don't just subscribe to "news", but the whole Amazon Resource Name (ARN)
        TopicArn: 'arn:aws:sns:us-east-1:566655405146:TestingSns',
        Endpoint: 'http://lowcost-env.9crvxnvbng.us-east-1.elasticbeanstalk.com/'
    }, function(error, data) {
        console.log(error || data);
    });

});

//AWS-SNS


setInterval(function readQueueMessages() {
    var app = consumer.create({
        queueUrl: "https://sqs.us-east-1.amazonaws.com/566655405146/MyFirstQueue",
        region: 'us-east-1',
        batchSize: 10,
        handleMessage: function(message, done) {

            var msgBody = JSON.parse(message.Body);
            console.log("The message Body is: " + msgBody);
            sentimentAnalysis(msgBody);
            return done();

        }
    });

    app.on('error', function(err) {
        console.log(err);
    });

    app.start();

}, 10000);


//Method to check for sentimental analysis
function sentimentAnalysis(params) {
    console.log("Inside sentimentAnalysis");
    var msg = {
        text: ''
    };
    msg.text = JSON.stringify(params.text);
    alchemy.sentiment(msg, function(err, response) {
        if (err)
            console.log('error:', err);
        else {
            console.log(JSON.stringify(response.docSentiment.type, null, 2));
            params.latlong.sentiment = JSON.stringify(response.docSentiment.type, null, 2);
            publishToSns(params);// Function call to publish message to the httpEndpoint
            emitTweets(params.latlong);// Function to emit tweets to front end
        }
    });

}



//AMAZON SQS

var receipt = "";


// Instantiate SQS.
var sqs = new aws.SQS();

// Creating a queue.
app.get('/create', function(req, res) {
    console.log("In Create Method");
    var params = {
        QueueName: "MyFirstQueue"
    };

    sqs.createQueue(params, function(err, data) {
        if (err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
});

// Listing our queues.
app.get('/list', function(req, res) {
    sqs.listQueues(function(err, data) {
        if (err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
});


// Method for sending tweets to the queue
function sendTweetsToQueue(tweet) {
    var params = {
        MessageBody: JSON.stringify(tweet),
        QueueUrl: queueUrl,
        DelaySeconds: 0
    };

    sqs.sendMessage(params, function(err, data) {
        if (err) {
            ("Error in SQS");
        } else {
            ("Message queued into SQS");
        }
    });
}


//Configuring the twitter credentials(Loading environment variables from .env file)
var twitterCredentials = new twitter({
    consumer_key: process.env.consumer_key,
    consumer_secret: process.env.consumer_secret,
    access_token_key: process.env.access_token_key,
    access_token_secret: process.env.access_token_secret
});

//Configuring the AWS elastic search
var es = new elasticsearch.Client({
    hosts: 'https://search-myelasticsearch-crjoshl4amjqmk6cxyo3fwcaeq.us-east-1.es.amazonaws.com/',
    connectionClass: awsEs,
    amazonES: {
        region: 'us-east-1',
        accessKey: process.env.aws_access_key_id,
        secretKey: process.env.aws_secret_access_key
    }
});
var stream = null;

app.use(express.static("./public"));

var item = "Donald Trump";

app.get("/:item", function(req, res) {
    console.log(req.params.item);
    item = req.params.item;
    es.cluster.health({}, function(err, resp, status) {
        console.log("-- Client Health --", resp);
    });

});

function emitTweets(latlong) {
    console.log("Emitting Tweets");
    console.log(`The latitude and longitude are :${latlong}`)
    globalSocket.emit("tweetStream", latlong);
}

setInterval(function() {
    es.indices.delete({
        index: 'tweets'
    }, function(err, res, status) {
        console.log("delete", res);
    });
}, 10000);

//Function to save tweets in Elastic Search
function saveInEs(tweet) {
    console.log("Saving in elasticsearch");
    var id = indexEs+1;
    indexEs=indexEs+1;
    es.index({
        index: 'tweets',
        type: 'tweet',
        id: id,
        body: tweet
    }, function(err, resp) {
        if (!err) {
          console.info(resp);
        }
    });
}

//Websockets to handle twitter streaming
io.sockets.on('connection', function(socket) {
    globalSocket = socket;
    socket.on("saveOldTweet", function() {
        saveOldTweet();
    })

    socket.on("start-streaming", function(item) {
        console.log("Streaming started");
        console.log(`The item value is:-> ${item}`)
        if (stream === null) {
            console.log("Stream is null");
            twitterCredentials.stream('statuses/filter', {
                track: item, language:'en'
            }, function(stream) {
                stream.on('data', function(tweet) {
                    console.log(`item is ${item}`);
                    console.log("Tweets started");
                    if (tweet.place) {
                        if (tweet.place.bounding_box) {
                            console.log("Bounding box entered");
                            if (tweet.place.bounding_box) {
                                if (tweet.place.bounding_box.type === 'Polygon') {
                                    var crd = tweet.place.bounding_box.coordinates[0][0];
                                    var latlong = {
                                        "latitude": crd[0],
                                        "longitude": crd[1],
                                        "title": tweet.place.full_name,
                                        "sentiment": ""
                                    };
                                    var feeds = {
                                        "text": tweet.text,
                                        "latlong": latlong
                                   }
                                    sendTweetsToQueue(feeds);
                                }
                            }
                        }
                    }
                });

                stream.on('error', function(error) {
                    throw error;
                });

                stream.on('limit', function(msg) {
                    console.log(msg);
                });

                stream.on('warning', function(warning) {
                    console.log(msg);
                });

                stream.on('disconnect', function(msg) {
                    console.log(msg);
                });
            });
        };
    });

    socket.on('error', function(error) {
        throw error;
        io.connect(server, {
            'force new connection': true
        });

    });

    socket.emit("connected");
});


console.log("Listening on port: " + PORT);