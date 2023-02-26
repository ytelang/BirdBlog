var express = require("express");
var app = express();
const port = 3000;
const router = express.Router();
var bodyParser = require("body-parser");
var postList = [];
var testR = "";

const CronJob = require("node-cron");
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

// MongoDB Atlas Connection Code
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
// Post is our database of generated blogPosts
const Post = client.db("bird_blogs").collection("blogPosts");

// grabs the n most recently generated posts
async function getLatestPosts(client, n) {
  const posts = await client
    .db("bird_blogs")
    .collection("blogPosts")
    .find({})
    .sort({ timestamp: -1 })
    .limit(n);

  return new Promise((resolve, reject) => {
    resolve(posts.toArray());
  });
}

function chooseRandom(arr) {
  const random = Math.floor(Math.random() * arr.length);
  return arr[random];
}

// grab a list of all trends in our manual dataset
async function getTrends(client) {
  const trends = await client
    .db("bird_blogs")
    .collection("twitterPosts")
    .find({})
    .project({ trend: 1, _id: 0 });

  return new Promise((resolve, reject) => {
    resolve(trends.toArray());
  });
}

// finds associated tweets with a given trend (since we have no Twitter API currently, just grab from our manual dataset in mongodb)
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

// inserts a newPost from generateTestDBPost into mongodb
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

  totals = { positive: 0, negative: 0 }; //  we are not looking at the returned "neutral" count
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result.error) {
      for (const [key, val] of Object.entries(result.confidenceScores)) {
        if (key != "neutral") totals[key] += val;
      }
    } else {
      console.error(`\tError: ${result.error}`);
    }
  }
  const result = Object.entries(totals).reduce((a, b) =>
    a[1] > b[1] ? a : b
  )[0];
  return new Promise((resolve, reject) => {
    resolve(result);
  });
}

// generate docs for Sentiment Analysis
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

// formats given data into a BSON object for rendering
function generateTestDBPost(text, image, sentiment, trend) {
  return {
    trend: trend,
    timestamp: new Date(),
    content: text,
    sentiment: sentiment,
    image: image,
    views: 0,
  };
}

app.use(bodyParser.json());

app.set("view engine", "ejs");

// scheduledFunctions.initScheduledJobs();

const scheduledJobFunction = CronJob.schedule("* * * * *", async () => {
  console.log("Producing blog post!");
  await produceBlogPost();
  console.log("Done!");
});

// send a query every time unit (* * * * *) means every minute
scheduledJobFunction.start();

// Connect to Atlas MongoDB
// Connection is open for the entirety of the website's lifetime
dbConnect().catch(console.error);

//Testing API

// connect to OpenAI API with a key
const { Configuration, OpenAIApi } = require("./node_modules/openai/dist");

const configuration = new Configuration({
  apiKey: secrets.OPEN_AI_KEY,
});
const openai = new OpenAIApi(configuration);

// sends a request to GPT3 with OpenAI API
async function getResponse(trend, sentiment) {
  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: "write a " + sentiment + " blog about " + trend,
    max_tokens: 1090,
  });
  try {
    let response = completion.data.choices[0].text;
    console.log(response);

    cleanedResponse = response.trim();
    return new Promise((resolve, reject) => {
      resolve(cleanedResponse);
    });
  } catch (e) {
    console.error(e);
  }

  let response = completion.data.choices[0].text;
  console.log(response);

  cleanedResponse = response.trim();
  return new Promise((resolve, reject) => {
    resolve(cleanedResponse);
  });
}

// sends a request to DALL-E with OpenAI API
async function getImage(trend, sentiment) {
  const image = await openai.createImage({
    prompt:
      "a photo of " + trend + " depicted in a " + sentiment + " connotation",
    n: 1,
    size: "1024x1024",
  });
  image_url = image.data.data[0].url;
  return new Promise((resolve, reject) => {
    resolve(image_url);
  });
}

// gets blog posts, sorted in order of most viewed and only the top 3
async function getTop3(client) {
  const results = await Post.find({ views: { $gte: 0 } })
    .project({ trend: 1, views: 1 })
    .sort({ views: -1 })
    .limit(3);
  return new Promise((resolve, reject) => {
    resolve(results.toArray());
  });
}

// generates a blog post and places it in the mongodb
async function produceBlogPost() {
  console.log("Blog begin");
  let trends = await getTrends(client);
  let trendList = [];
  for (const [key, val] of Object.entries(trends)) trendList.push(val);
  let trend = chooseRandom(trendList).trend;
  let posts = await getTrendingPosts(client, trend).catch((err) => {
    console.error(err);
  });
  let documents = generateSADocs(posts[0].posts);
  let sentiment = await analyzeSentiments(documents);
  let text = await getResponse(trend, sentiment);
  let img = await getImage(trend, sentiment);
  let blogPost = generateTestDBPost(text, img, sentiment, trend);
  await insertBlogPost(client, blogPost);
}

module.exports = { produceBlogPost };

// End testing API

// anytime page loads, get 5 most recent and top 3 viewed posts
app.get("/", async (req, res) => {
  postList = await getLatestPosts(client, 5);
  let topViews = await getTop3(client);
  top3 = [topViews[0], topViews[1], topViews[2]];
  res.render("../index.ejs", {
    tweet: testR,
    latestPosts: postList,
    topPosts: top3,
  });
});

// anytime we send a post request from the cron-job, create and refresh page
app.post("/", async (req, res) => {
  await produceBlogPost();
  res.redirect("back");
});

// Increments view count for a post by 1, directs to a page with only that post on it
app.get("/post/:id", async (req, res) => {
  await Post.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $inc: { views: 1 } }
  );
  const post = await Post.findOne({ _id: new ObjectId(req.params.id) });
  res.render("../post.ejs", {
    post,
  });
});

// Returns up to 512 of the most recent posts
app.get("/all_posts", async (req, res) => {
  postList = await getLatestPosts(client, 512);
  let topViews = await getTop3(client);
  top3 = [topViews[0],topViews[1],topViews[2]]
  res.render("../giga.ejs", {
    postList:postList,
    topPosts:top3,
  });
});

console.log("Operating on Port: " + port);
app.listen(process.env.PORT || port, "0.0.0.0");
