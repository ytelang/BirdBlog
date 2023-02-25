var express = require('express');
var app = express();
const port = 3000
const router = express.Router();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true });
var responses = []
var testR = "testR"

const fs = require('fs');

// Load secrets
const secrets = JSON.parse(require('child_process').execSync('node doppler-secrets.js'));


// MongoDB Atlas Connection Code
const { MongoClient, ServerApiVersion } = require('./webpage/node_modules/mongodb/mongodb');
const dbPass = secrets.MONGO_DB_PASS;
const uri = "mongodb+srv://hackbird23:" + dbPass + "@birdcluster0.ttenopu.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Test DB connection
client.connect(err => {
  const collection = client.db("sample_mflix").collection("comments");
  // perform actions on the collection object
  client.close();
});

app.use(bodyParser.json());

app.set('view engine', 'ejs');

//Testing API

async function getResponse() {
        const { Configuration, OpenAIApi } = require("./webpage/node_modules/openai/dist");

        const configuration = new Configuration({
        apiKey: secrets.OPEN_AI_KEY,
        });
        const openai = new OpenAIApi(configuration);

        const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: "write a short rap dissing league of legends players",
        max_tokens: 1090,
        });
        let response = completion.data.choices[0].text
        //console.log(response);
        responses.concat(response)
        testR = response
        return 
}


// End testing API



app.get('/', function(req, res) {
        //getResponse()
        let tweet = testR
        //console.log(tweet)
        //res.render('../index.ejs')
        
        res.render('../index.ejs', {
                tweet : tweet
        });
        
        
});


app.post('/', (req, res) => {
        getResponse()
        let tweet = testR
        //console.log(tweet)
        //res.render('../index.ejs')
        
        res.render('../index.ejs', {
                tweet : tweet
        });
});

app.use('/', router);
console.log('Operating on Port: '+port);
app.listen(process.env.port || port);
