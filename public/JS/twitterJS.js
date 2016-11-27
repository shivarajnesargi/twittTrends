 var map;
 var markers = [];
 var socket = io();
 socket.on("connected", function() {
     console.log("Connected to the server socket");
 });

 socket.on("disconnected", function() {
     console.log("Disconnected from the server");
 });

 socket.on("tweetStream", function(tweet) {
     console.log("Connected to the twitter stream");
     var location = new google.maps.LatLng(tweet.longitude, tweet.latitude);
     console.log(tweet.sentiment);
     var title = tweet.title;
     var sentiment = JSON.parse(tweet.sentiment);
     displayNotification();
     if (sentiment == 'positive') {
         console.log("Postive Marker confirmed")
         addPositiveMarker(location, title);
     } else if (sentiment == 'negative') {
         console.log("Negative marker confirmed");
         addNegativeMarker(location, title);
     } else {
         addNeutralMarker(location, title);
     }

 });

 function displayNotification() {
     if (Notification.permission == "granted") {
         var data = {
             msg: "New Tweet has arrived"
         };
         var e = new Notification("Tweet Notification", {
             body: data.msg,
             icon: "https://cdn1.iconfinder.com/data/icons/iconza-circle-social/64/697029-twitter-512.png"
         });
         setTimeout(e.close.bind(e), 3000);
     }
 }

 function initMap() {
     map = new google.maps.Map(document.getElementById('map'), {
         center: {
             lat: 51.5074,
             lng: 0.1278
         },
         zoom: 2
     });

     Notification.requestPermission();
 };

 function addNegativeMarker(location, title) {
     console.log("Inside negative marker");
     var marker = new google.maps.Marker({
         position: location,
         map: map,
         title: title
     });
     markers.push(marker);
 };

 function addPositiveMarker(location, title) {
     console.log("Inside Positive")
     var marker = new google.maps.Marker({
         position: location,
         map: map,
         title: title
     });
     marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png')
     markers.push(marker);
 }

 function addNeutralMarker(location, title) {
     console.log("Inside Neutral")
     var marker = new google.maps.Marker({
         position: location,
         map: map,
         title: title
     });
     marker.setIcon(' http://maps.google.com/mapfiles/ms/icons/yellow-dot.png')
     markers.push(marker);
 }


 function setMapOnAll(map) {
     for (var i = 0; i < markers.length; i++) {
         markers[i].setMap(map);
     }
 };

 function deleteMarkers() {
     setMapOnAll(null);
     markers = [];
 };

 function selectItem(value) {
     if (value == null || value == "") {
         alert("Select some item to begin with");
     } 
     else {
         alert("Tweets for " + value.toUpperCase() + " will start now");
         deleteMarkers();
         socket.emit("start-streaming", value);
     }
 };