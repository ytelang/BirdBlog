var express = require("express");
var app = express();
const port = 3000;
const router = express.Router();
var bodyParser = require("body-parser");
var urlencodedParser = bodyParser.urlencoded({ extended: true });
var responses = [];
var testR = "";

const fs = require("fs");

// Load secrets
const secrets = JSON.parse(
  require("child_process").execSync("node doppler-secrets.js")
);

// MongoDB Atlas Connection Code
const { MongoClient, ServerApiVersion } = require("mongodb");
// const { get } = require("http");
const dbPass = secrets.MONGO_DB_PASS;
const uri =
  "mongodb+srv://hackbird23:" +
  dbPass +
  "@birdcluster0.ttenopu.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function dbConnect() {
  try {
    // Connect to the MongoDB cluster
    await client.connect();
  } catch (e) {
    console.error(e);
  }
}

async function getDbList(client) {
  databasesList = await client.db().admin().listDatabases();

  let dbNames = [];

  databasesList.databases.forEach((db) => dbNames.push(db.name));
  const dbsJoined = dbNames.join(", ");
  return new Promise((resolve, reject) => {
    resolve(dbsJoined);
  });
}

async function findOneListingByName(client, nameOfListing) {
  const result = await client
    .db("sample_airbnb")
    .collection("listingsAndReviews")
    .findOne({ name: nameOfListing });

  if (result) {
    console.log(
      `Found a listing in the collection with the name '${nameOfListing}':`
    );
    console.log(result);
  } else {
    console.log(`No listings found with the name '${nameOfListing}'`);
  }
}

async function insertBlogPost(client, newPost) {
  const result = await client
    .db("bird_blogs")
    .collection("blogPosts")
    .insertOne(newPost);
  console.log(`New post created with the following id: ${result.insertedId}`);
}

function generateTestDBPost(text) {
  return {
    title: "Test Blog Post",
    trend: "League of Legends",
    timestamp: new Date(),
    content: text,
    sentiment: "Negative"
  }
} 

app.use(bodyParser.json());

app.set("view engine", "ejs");

// Connect to Atlas MongoDB
// Connection is open for the entirety of the website's lifetime
dbConnect().catch(console.error);

//Testing API

async function getResponse() {
  const { Configuration, OpenAIApi } = require("./node_modules/openai/dist");

  const configuration = new Configuration({
    apiKey: secrets.OPEN_AI_KEY,
  });
  const openai = new OpenAIApi(configuration);

  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: "write a short rap dissing league of legends players",
    max_tokens: 1090,
  });

  let response = completion.data.choices[0].text;
  console.log(response);
  // responses.concat(response);

  cleanedResponse = response.trim() + "\nBars";
  return new Promise((resolve, reject) => {
    resolve(cleanedResponse);
  });
}

// End testing API

app.get("/", (req, res) => {
  res.render("../index.ejs", {
    tweet: testR,
  });
});

app.post("/", async (req, res) => {
  let text = await getResponse();
  testR = text;
  res.redirect("back");
  let blogPost = generateTestDBPost(text);
  await insertBlogPost(client, blogPost);
});

app.get("/list-dbs", async (req, res) => {
  testR = await getDbList(client);
  res.redirect("back");
});

//app.use("/", router);
console.log("Operating on Port: " + port);
app.listen(process.env.PORT || port, "0.0.0.0");
