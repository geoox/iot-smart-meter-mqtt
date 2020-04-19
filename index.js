const express = require('express')
var mqtt = require("mqtt");
var hexToBinary = require("hex-to-binary");
var atob = require("atob");
const cors = require('cors');
var axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const corsWhitelist = [
  'http://localhost:8070/',
  'http://localhost:8100/',
  'http://localhost:3000/',
  'http://localhost:8080/'
]

const port = process.env.PORT || 8070;

app.use((req, res, next)=>{
  res.header('Access-Control-Allow-Origin', '*');
  if(corsWhitelist.indexOf(req.headers.origin)!== -1){
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, X-Requested-With, Accept, Authorization');
  }
  if(req.method === 'OPTIONS'){
      res.header('Access-Control-Allow-Methods','GET, PUT, POST, PATCH, DELETE');
      res.status(200).json({});
  }
  next();
})


var client = mqtt.connect("mqtts://influx.itu.dk", {
  username: "smartreader",
  password: "4mp3r3h0ur",
  port: 8883,
  rejectUnauthorized: false,
});

client.on("connect", function () {
  console.log("CONNECTED");
  client.subscribe("IoT2020sec/meters", function (err) {
    console.log("SUBSCRIBED");
  });
});

client.on("message", function (topic, message) {
  const base64Message = message.toString();
  const bin = atob(base64Message);

  // copy pasted from web, might need to quote it..
  let hexString = "";
  for (let i = 0; i < bin.length; i++) {
    const hex = bin.charCodeAt(i).toString(16);
    hexString += hex.length === 2 ? hex : "0" + hex;
  }
  console.log("hexString: " + hexString);
  const binaryMessage = hexToBinary(hexString);
  console.log("binary: " + binaryMessage);

  const measurementType = binaryMessage.slice(0, 1);
  const meterId = binaryMessage.slice(1, 8);
  const timestamp_binary = binaryMessage.slice(8, 40);
  const reading = binaryMessage.slice(40, 56);

  const timestamp = new Date(parseInt(timestamp_binary, 2) * 1000);

  const req = {
    meter_id: parseInt(meterId, 2),
    reading: parseInt(reading, 2),
    timestamp: timestamp,
    type: measurementType,
  };

  const API_URL = "https://iot-smart-meter.herokuapp.com/new_recording";
  axios.post(API_URL, req)
  .then(
    response => console.log("Successfully sent data to DB for meter id:" + req.meter_id), 
    err => console.log(err)
  );
});

client.on("error", function (error) {
  console.log("Can't connect" + error);
});

app.listen(port, ()=> console.log("Listening to 8070..."));
