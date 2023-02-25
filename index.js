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

const scheduledFunctions = require("./scheduledFunctions/schedule-post");

// Load secrets
const secrets = JSON.parse(
  require("child_process").execSync("node doppler-secrets.js")
);

const az_key = secrets.AZURE_LANG_KEY;
const az_endpoint = secrets.AZURE_LANG_EP;

// MongoDB Atlas Connection Code
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

async function getTrends(client) {
  const trends = await client.db("bird_blogs").collection("blogPosts").find({});
}

async function getTrendingPosts(client, trend) {
  const trendposts = await client
    .db("bird_blogs")
    .collection("twitterPosts")
    .find({ trend: trend })
    .project({ posts: 1, _id: 0 });

  return new Promise((resolve, reject) => {
    resolve(trendposts.toArray());
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
  // getTrendingPosts();
  // console.log(documents);
  const saClient = new TextAnalyticsClient(
    az_endpoint,
    new AzureKeyCredential(az_key)
  );

  const results = await saClient.analyzeSentiment(documents, {
    includeOpinionMining: true,
  });

  totals = {"positive": 0, "negative": 0};
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    // console.log(`- Document ${result.id}`);
    if (!result.error) {
      for (const [key, val] of Object.entries(result.confidenceScores)) {
        if (key != "neutral") totals[key] += val ;
      }
    } else {
      console.error(`\tError: ${result.error}`);
    }
  }
  // console.log(totals);
  const result = Object.entries(totals).reduce((a, b) => a[1] > b[1] ? a : b)[0]
  return new Promise((resolve, reject) => {
    resolve(result);
  });
}

function generateSADocs(strArr) {
  documents = [];
  strArr.map(function (post, idx) {
    documents.push({
      text: post,
      id: idx.toString(),
      language: "en",
    });
  });
  return documents;
}

function generateTestDBPost(text, image, sentiment, trend, title) {
  return {
    title: title,
    trend: trend,
    timestamp: new Date(),
    content: text,
    sentiment: sentiment,
    image: image
  };
}

app.use(bodyParser.json());

app.set("view engine", "ejs");

scheduledFunctions.initScheduledJobs();

// Connect to Atlas MongoDB
// Connection is open for the entirety of the website's lifetime
dbConnect().catch(console.error);

//Testing API

const { Configuration, OpenAIApi } = require("./node_modules/openai/dist");

  const configuration = new Configuration({
    apiKey: secrets.OPEN_AI_KEY,
  });
  const openai = new OpenAIApi(configuration);

async function getResponse(trend, sentiment) {
  
  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: "write a "+sentiment+" blog about "+trend,
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

async function getImage(trend, sentiment) {
  const image = await openai.createImage({
    prompt: "a photo of "+trend+" depicted in a "+sentiment+" manner",
    n: 1,
    size: "1024x1024",
  });
  image_url = image.data.data[0].url;
  return new Promise((resolve, reject) => {
    resolve(image_url);
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
  let trend = "League of Legends"
  let posts = await getTrendingPosts(client, "Testing").catch((err) => {
    console.error(err);
  });
  let documents = generateSADocs(posts[0].posts);
  let sentiment = await analyzeSentiments(documents);
  console.log(sentiment);

  let text = await getResponse(trend, sentiment);
  let img = await getImage(trend, sentiment);
  res.redirect("back");
  let blogPost = generateTestDBPost(text, img, sentiment, trend, "Test Blog Post");
  await insertBlogPost(client, blogPost);
});

app.post("/test-sa", async (req, res) => {
  res.redirect("back");
  let posts = await getTrendingPosts(client, "Testing").catch((err) => {
    console.error(err);
  });
  // console.log(posts[0].posts);
  let documents = generateSADocs(posts[0].posts);
  let sentiment = await analyzeSentiments(documents);
  console.log(sentiment);
});

app.get("/post/:id", async (req, res) => {
  const post = await Post.findOne({ _id: new ObjectId(req.params.id) });
  res.render("../post.ejs", {
    post,
  });
});

//app.use("/", router);
console.log("Operating on Port: " + port);
app.listen(process.env.PORT || port, "0.0.0.0");
