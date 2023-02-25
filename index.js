var express = require("express");
var app = express();
const port = 3000;
const router = express.Router();
var bodyParser = require("body-parser");
var urlencodedParser = bodyParser.urlencoded({ extended: true });
var responses = [];
var postList = [];
var testR = "";

const fs = require("fs");
const {
  TextAnalyticsClient,
  AzureKeyCredential,
} = require("@azure/ai-text-analytics");

// Load secrets
const secrets = JSON.parse(
  require("child_process").execSync("node doppler-secrets.js")
);

const az_key = secrets.AZURE_LANG_KEY;
const az_endpoint = secrets.AZURE_LANG_EP;

const TEST_DOCUMENTS = [
  {
    text: "League of Legends is a terrible game. Sometimes matches are fun but the community is just too toxic.",
    id: "0",
    language: "en",
  },
];

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

const Post = client.db("bird_blogs").collection("blogPosts");

async function getDbList(client) {
  databasesList = await client.db().admin().listDatabases();

  let dbNames = [];

  databasesList.databases.forEach((db) => dbNames.push(db.name));
  const dbsJoined = dbNames.join(", ");
  return new Promise((resolve, reject) => {
    resolve(dbsJoined);
  });
}

async function getLatestPosts(client, n) {
  const posts = await client
    .db("bird_blogs")
    .collection("blogPosts")
    .find({}, { title: 1, _id: 0 })
    .sort({ timestamp: -1 })
    .limit(n);

  return new Promise((resolve, reject) => {
    resolve(posts.toArray());
  });
}

async function insertBlogPost(client, newPost) {
  const result = await client
    .db("bird_blogs")
    .collection("blogPosts")
    .insertOne(newPost);
  console.log(`New post created with the following id: ${result.insertedId}`);
}

async function analyzeSentiments(documents) {
  const saClient = new TextAnalyticsClient(
    az_endpoint,
    new AzureKeyCredential(az_key)
  );

  const results = await saClient.analyzeSentiment(documents, {
    includeOpinionMining: true,
  });

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log(`- Document ${result.id}`);
    if (!result.error) {
      console.log(`\tDocument text: ${documents[i].text}`);
      console.log(`\tOverall Sentiment: ${result.sentiment}`);
      console.log("\tSentiment confidence scores:", result.confidenceScores);
      console.log("\tSentences");
      for (const {
        sentiment,
        confidenceScores,
        opinions,
      } of result.sentences) {
        console.log(`\t- Sentence sentiment: ${sentiment}`);
        console.log("\t  Confidence scores:", confidenceScores);
        console.log("\t  Mined opinions");
        for (const { target, assessments } of opinions) {
          console.log(`\t\t- Target text: ${target.text}`);
          console.log(`\t\t  Target sentiment: ${target.sentiment}`);
          console.log(
            "\t\t  Target confidence scores:",
            target.confidenceScores
          );
          console.log("\t\t  Target assessments");
          for (const { text, sentiment } of assessments) {
            console.log(`\t\t\t- Text: ${text}`);
            console.log(`\t\t\t  Sentiment: ${sentiment}`);
          }
        }
      }
    } else {
      console.error(`\tError: ${result.error}`);
    }
  }
}

function generateTestDBPost(text) {
  return {
    title: "Test Blog Post",
    trend: "League of Legends",
    timestamp: new Date(),
    content: text,
    sentiment: "Negative",
  };
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

app.get("/", async (req, res) => {
  postList = await getLatestPosts(client, 5);
  res.render("../index.ejs", {
    tweet: testR,
    latestPosts: postList,
  });
});

app.post("/", async (req, res) => {
  let text = await getResponse();
  res.redirect("back");
  let blogPost = generateTestDBPost(text);
  await insertBlogPost(client, blogPost);
});

app.post("/test-sa", async (req, res) => {
  res.redirect("back");
  await analyzeSentiments(TEST_DOCUMENTS).catch((err) => {
    console.error("Sample encoutered an error:", err);
  });
});

/**
 * @todo Create frontend .ejs for viewing an individual blog post.
 */
app.get("/post/:id", async (req, res) => {
  const post = await Post.findById(req.params.id);
  res.render("../post.ejs", {
    post
  });
});

//app.use("/", router);
console.log("Operating on Port: " + port);
app.listen(process.env.PORT || port, "0.0.0.0");
