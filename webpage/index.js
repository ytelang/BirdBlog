var express = require('express');
var app = express();
const port = 3000
const router = express.Router();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true });
var responses = []
var testR = "testR"

const fs = require('fs')

app.use(bodyParser.json());

app.set('view engine', 'ejs');

//Testing API

async function getResponse() {
        const { Configuration, OpenAIApi } = require("openai");

        const configuration = new Configuration({
        apiKey: "",
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
        getResponse()
        let tweet = testR
        console.log(tweet)
        //res.render('../index.ejs')
        
        res.render('../index.ejs', {
                tweet : tweet
        });
        
        
});


app.post('/', (request, response) => {
        console.log(request.body);
        
        var jsonRequest = request.body;
        var name = jsonRequest.name;
        mainDiction[name] = jsonRequest;
        var jsonResponse = jsonRequest.name;
        response.send(jsonResponse);
        
});

app.use('/', router);
console.log('Operating on Port: '+port);
app.listen(process.env.port || port);
