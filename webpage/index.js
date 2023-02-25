var express = require('express');
var app = express();
const port = 3000
const router = express.Router();
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: true });

const fs = require('fs')

app.use(bodyParser.json());

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
        
        res.render('../index.ejs')
        /*
        res.render('index.ejs', {
                
        });
        */
        
});

/*
app.post('/', (request, response) => {
        console.log(request.body);
        
        var jsonRequest = request.body;
        var name = jsonRequest.name;
        mainDiction[name] = jsonRequest;
        var jsonResponse = jsonRequest.name;
        response.send(jsonResponse);
        
});
*/
app.use('/', router);
console.log('Operating on Port: '+port);
app.listen(process.env.port || port);
